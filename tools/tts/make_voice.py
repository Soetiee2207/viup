# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts>=7"]
# ///
"""Đọc spec.json (VideoSpec) hoặc script.txt cũ -> tạo giọng đọc + manifest cho Remotion.

spec.json: {"hook": "...", "music": "...", "lines": [{"text", "emotion", "beats": [...]}]}
(xem packages/video/README.md). Các trường ngoài "text"/"emotion" được chép nguyên vào manifest.

script.txt (định dạng cũ): mỗi dòng trong script.txt là một câu thoại. Có thể gắn cảm xúc ở đầu dòng:
    [vui] Xin chào các bạn!
    [ngacnhien] Bạn có biết...
    [buon] Tiếc là...
Sau cảm xúc có thể khai báo hình minh hoạ (tên icon Fluent Emoji, xN = số lượng)
và nhãn chữ to sau dấu |:
    [ngacnhien] {octopus, red-heart x3 | 3 TRÁI TIM} Bạch tuộc có 3 trái tim!
Câu không khai báo hình sẽ giữ hình của câu trước.
Dòng trống và dòng bắt đầu bằng # bị bỏ qua.

Đầu ra (trong thư mục --out):
    voice.wav      - toàn bộ giọng đọc, nối liền
    manifest.json  - thời điểm từng câu, từng từ (WordBoundary) + độ to theo từng khung hình
"""

import argparse
import array
import asyncio
import hashlib
import json
import math
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import edge_tts

FPS = 30
SAMPLE_RATE = 24000
GAP_SECONDS = 0.25
EMOTIONS = {"vui", "buon", "ngacnhien", "binhthuong"}
# Giọng nhân vật khách (spec.guest.voice) cho câu có "speaker": "guest": (giọng, tốc độ, cao độ)
GUEST_VOICES = {
    "nu": ("vi-VN-HoaiMyNeural", "+12%", "+0Hz"),
    "be": ("vi-VN-HoaiMyNeural", "+18%", "+35Hz"),
    "tram": ("vi-VN-NamMinhNeural", "+6%", "-28Hz"),
}


def parse_script(path: Path) -> list[dict]:
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        emotion = "binhthuong"
        m = re.match(r"^\[(\w+)\]\s*(.*)$", raw)
        if m:
            tag = m.group(1).lower()
            if tag not in EMOTIONS:
                raise SystemExit(f"Cảm xúc không hợp lệ: [{tag}] (chỉ dùng {sorted(EMOTIONS)})")
            emotion, raw = tag, m.group(2)
        props, label = [], None
        m = re.match(r"^\{([^}]*)\}\s*(.*)$", raw)
        if m:
            icons, _, label = m.group(1).partition("|")
            for item in filter(None, (x.strip() for x in icons.split(","))):
                name, _, count = item.partition(" x")
                props.append({"icon": name.strip(), "count": int(count or 1)})
            label = label.strip() or None
            raw = m.group(2)
        lines.append({"text": raw, "emotion": emotion, "props": props, "label": label})
    if not lines:
        raise SystemExit(f"{path} không có câu thoại nào")
    return lines


def load_spec(path: Path) -> dict:
    if path.suffix == ".txt":
        return {"lines": parse_script(path)}
    spec = json.loads(path.read_text(encoding="utf-8"))
    lines = spec.get("lines") or []
    if not lines:
        raise SystemExit(f"{path} không có câu thoại nào")
    for i, line in enumerate(lines, 1):
        if not str(line.get("text", "")).strip():
            raise SystemExit(f"Câu {i} thiếu \"text\"")
        line.setdefault("emotion", "binhthuong")
        if line["emotion"] not in EMOTIONS:
            raise SystemExit(f"Câu {i}: cảm xúc không hợp lệ \"{line['emotion']}\" (chỉ dùng {sorted(EMOTIONS)})")
    return spec


def norm(s: str) -> str:
    return "".join(c for c in s.lower() if c.isalnum())


def align_words(text: str, boundaries: list[dict], offset: float, end: float) -> list[dict]:
    """Gán mốc thời gian WordBoundary cho từng từ hiển thị (tách theo khoảng trắng, giữ dấu câu).

    So khớp theo vị trí ký tự (bỏ dấu câu), co giãn theo tỉ lệ nếu chuỗi đọc khác chuỗi hiển thị."""
    tokens = text.split()
    if not boundaries:
        # Không có mốc -> chia đều theo số ký tự
        total = sum(len(t) for t in tokens) or 1
        out, seen = [], 0
        for t in tokens:
            a = offset + (end - offset) * seen / total
            seen += len(t)
            out.append({"text": t, "start": round(a, 3), "end": round(offset + (end - offset) * seen / total, 3)})
        return out
    # Thời điểm bắt đầu/kết thúc của từ đọc chứa từng ký tự
    bchars = []
    for b in boundaries:
        bchars += [(b["start"], b["start"] + b["duration"])] * max(1, len(norm(b["text"])))
    tchars = sum(len(norm(t)) for t in tokens) or 1
    scale = len(bchars) / tchars
    out, seen = [], 0
    for t in tokens:
        first = min(len(bchars) - 1, int(seen * scale))
        seen += len(norm(t))
        last = max(first, min(len(bchars) - 1, int(seen * scale) - 1))
        out.append({"text": t, "start": round(offset + bchars[first][0], 3), "end": round(min(end, offset + bchars[last][1]), 3)})
    return out


async def tts_to_pcm(text: str, voice: str, rate: str, tmp: Path, pitch: str = "+0Hz") -> tuple[bytes, list[dict]]:
    """Trả về (PCM, danh sách WordBoundary {text, start, duration} tính bằng giây)."""
    mp3 = tmp / "line.mp3"
    # Dịch vụ edge-tts thỉnh thoảng trả về rỗng ngẫu nhiên -> thử lại vài lần
    for attempt in range(1, 6):
        try:
            words = []
            with open(mp3, "wb") as f:
                async for chunk in edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary").stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        # offset/duration tính theo đơn vị 100ns
                        words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7, "duration": chunk["duration"] / 1e7})
            break
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 5:
                raise
            print(f"   lỗi tạm thời, thử lại ({attempt})...")
            await asyncio.sleep(attempt)
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        check=True,
        capture_output=True,
    ).stdout
    return pcm, words


def normalize(pcm: bytes) -> bytes:
    """Chuẩn hoá độ to về -14 LUFS (chuẩn của YouTube/TikTok), giữ nguyên độ dài."""
    fmt = ["-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE)]
    out = subprocess.run(
        ["ffmpeg", "-v", "error", *fmt, "-i", "-", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", *fmt, "-"],
        input=pcm,
        check=True,
        capture_output=True,
    ).stdout
    return out[: len(pcm)].ljust(len(pcm), b"\x00")


def envelope(pcm: bytes) -> list[float]:
    """Độ to (RMS) cho từng khung hình, chuẩn hoá về 0..1."""
    samples = array.array("h", pcm)
    per_frame = SAMPLE_RATE // FPS
    rms = []
    for i in range(0, len(samples), per_frame):
        chunk = samples[i : i + per_frame]
        rms.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)) if chunk else 0.0)
    peak = sorted(rms)[int(len(rms) * 0.95)] or 1.0
    return [round(min(1.0, v / peak), 3) for v in rms]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("script", type=Path, help="spec.json (hoặc script.txt cũ)")
    parser.add_argument("--out", type=Path, help="thư mục ghi voice.wav + manifest.json")
    parser.add_argument("--to-spec", type=Path, help="chỉ chuyển script.txt cũ sang spec.json rồi thoát")
    parser.add_argument("--voice", default="vi-VN-NamMinhNeural", help="giọng nam; giọng nữ: vi-VN-HoaiMyNeural")
    parser.add_argument("--rate", default="+16%", help="tốc độ đọc (số nguyên), vd +0%%, +16%%")
    args = parser.parse_args()

    spec = load_spec(args.script)
    if args.to_spec:
        for line in spec["lines"]:
            if not line["props"]:
                del line["props"]
            if line["label"] is None:
                del line["label"]
        args.to_spec.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Đã chuyển {args.script} -> {args.to_spec} (engine tự chia beat từ props/label của từng câu)")
        return
    if not args.out:
        parser.error("cần --out")
    lines = spec["lines"]
    gap = b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS)
    pcm = bytearray()

    with tempfile.TemporaryDirectory() as tmp:
        for i, line in enumerate(lines, 1):
            print(f"[{i}/{len(lines)}] {line['text']}")
            voice, rate, pitch = args.voice, args.rate, "+0Hz"
            if line.get("speaker") == "guest":
                voice, rate, pitch = GUEST_VOICES.get((spec.get("guest") or {}).get("voice") or "nu", GUEST_VOICES["nu"])
            audio, words = await tts_to_pcm(line["text"], voice, rate, Path(tmp), pitch)
            start = len(pcm) / 2 / SAMPLE_RATE
            pcm += audio
            end = len(pcm) / 2 / SAMPLE_RATE
            line["start"], line["end"] = round(start, 3), round(end, 3)
            line["words"] = align_words(line["text"], words, start, end)
            pcm += gap

    pcm = normalize(bytes(pcm))
    public = args.out
    public.mkdir(parents=True, exist_ok=True)
    with wave.open(str(public / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(pcm))

    manifest = {
        # render.ts so khớp mã băm này để bỏ qua bước TTS khi kịch bản không đổi
        "source": {
            "sha1": hashlib.sha1(args.script.read_bytes()).hexdigest(),
            "voice": args.voice,
            "rate": args.rate,
        },
        "hook": spec.get("hook"),
        "music": spec.get("music"),
        "guest": spec.get("guest"),
        "fps": FPS,
        "duration": round(len(pcm) / 2 / SAMPLE_RATE, 3),
        "lines": lines,
        "envelope": envelope(bytes(pcm)),
    }
    (public / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    print(f"Xong: {manifest['duration']}s, {len(lines)} câu -> {public}/voice.wav, manifest.json")


if __name__ == "__main__":
    asyncio.run(main())

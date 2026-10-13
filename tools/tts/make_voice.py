# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts>=7"]
# ///
"""Đọc script.txt -> tạo giọng đọc + manifest cho Remotion.

Mỗi dòng trong script.txt là một câu thoại. Có thể gắn cảm xúc ở đầu dòng:
    [vui] Xin chào các bạn!
    [ngacnhien] Bạn có biết...
    [buon] Tiếc là...
Dòng trống và dòng bắt đầu bằng # bị bỏ qua.

Đầu ra (trong thư mục --out):
    voice.wav      - toàn bộ giọng đọc, nối liền
    manifest.json  - thời điểm từng câu + độ to theo từng khung hình (để nhép miệng)
"""

import argparse
import array
import asyncio
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
        lines.append({"text": raw, "emotion": emotion})
    if not lines:
        raise SystemExit(f"{path} không có câu thoại nào")
    return lines


async def tts_to_pcm(text: str, voice: str, rate: str, tmp: Path) -> bytes:
    mp3 = tmp / "line.mp3"
    # Dịch vụ edge-tts thỉnh thoảng trả về rỗng ngẫu nhiên -> thử lại vài lần
    for attempt in range(1, 6):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(str(mp3))
            break
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 5:
                raise
            print(f"   lỗi tạm thời, thử lại ({attempt})...")
            await asyncio.sleep(attempt)
    return subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "-"],
        check=True,
        capture_output=True,
    ).stdout


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
    parser.add_argument("script", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="thư mục ghi voice.wav + manifest.json")
    parser.add_argument("--voice", default="vi-VN-HoaiMyNeural", help="hoặc vi-VN-NamMinhNeural (giọng nam)")
    parser.add_argument("--rate", default="+10%", help="tốc độ đọc, vd +0%%, +15%%")
    args = parser.parse_args()

    lines = parse_script(args.script)
    gap = b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS)
    pcm = bytearray()

    with tempfile.TemporaryDirectory() as tmp:
        for i, line in enumerate(lines, 1):
            print(f"[{i}/{len(lines)}] {line['text']}")
            audio = await tts_to_pcm(line["text"], args.voice, args.rate, Path(tmp))
            line["start"] = round(len(pcm) / 2 / SAMPLE_RATE, 3)
            pcm += audio
            line["end"] = round(len(pcm) / 2 / SAMPLE_RATE, 3)
            pcm += gap

    public = args.out
    public.mkdir(parents=True, exist_ok=True)
    with wave.open(str(public / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(bytes(pcm))

    manifest = {
        "fps": FPS,
        "duration": round(len(pcm) / 2 / SAMPLE_RATE, 3),
        "lines": lines,
        "envelope": envelope(bytes(pcm)),
    }
    (public / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    print(f"Xong: {manifest['duration']}s, {len(lines)} câu -> {public}/voice.wav, manifest.json")


if __name__ == "__main__":
    asyncio.run(main())

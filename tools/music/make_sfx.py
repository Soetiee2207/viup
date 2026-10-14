# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=2"]
# ///
"""Tổng hợp hiệu ứng âm thanh (SFX) bằng code -> MP3 (bản quyền thuộc về kênh).

    uv run tools/music/make_sfx.py packages/video/public/sfx

Tạo: whoosh (chuyển cảnh), pop (icon xuất hiện), boing (nhảy), ding (nhãn), scratch (bất ngờ).
"""

import argparse
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


def sweep(f0: float, f1: float, dur: float, curve: float = 1.0) -> np.ndarray:
    """Sóng sin quét tần số f0 -> f1 (curve > 1: đổi chậm ở đầu)."""
    t = t_axis(dur)
    f = f0 + (f1 - f0) * (t / dur) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lowpass(x: np.ndarray, cutoff: np.ndarray | float) -> np.ndarray:
    """Lọc thông thấp 1 cực, cutoff có thể thay đổi theo thời gian."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, (v, k) in enumerate(zip(x, a)):
        acc += k * (v - acc)
        y[i] = acc
    return y


def whoosh() -> np.ndarray:
    dur = 0.45
    t = t_axis(dur)
    env = np.sin(np.pi * (t / dur) ** 0.7) ** 2
    cutoff = 300 + 3500 * np.sin(np.pi * t / dur) ** 2
    noise = lowpass(rng.standard_normal(len(t)), cutoff)
    return noise * env * 3


def pop() -> np.ndarray:
    dur = 0.12
    t = t_axis(dur)
    return sweep(900, 250, dur, 0.5) * np.exp(-t * 40) * (1 - np.exp(-t * 3000))


def boing() -> np.ndarray:
    dur = 0.55
    t = t_axis(dur)
    # Tần số dao động quanh 220 Hz như lò xo
    f = 220 * (1 + 0.35 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 5)) * (1 + 0.6 * np.exp(-t * 12))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return tone * np.exp(-t * 5) * (1 - np.exp(-t * 800)) * 0.8


def ding() -> np.ndarray:
    dur = 1.0
    t = t_axis(dur)
    f = 1568  # G6
    tone = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)
    return tone * np.exp(-t * 4.5) * (1 - np.exp(-t * 2000)) * 0.5


def scratch() -> np.ndarray:
    # Kim đĩa than kéo ngược: 2 nhát quét nhanh của nhiễu lọc dải
    parts = []
    for dur, f0, f1 in [(0.12, 400, 2600), (0.18, 2400, 300)]:
        t = t_axis(dur)
        noise = rng.standard_normal(len(t))
        cutoff = f0 + (f1 - f0) * t / dur
        band = lowpass(noise, cutoff) - lowpass(noise, cutoff * 0.4)
        tone = sweep(f0 / 4, f1 / 4, dur) * 0.4
        parts.append((band * 3 + tone) * np.sin(np.pi * t / dur))
    return np.concatenate(parts)


SOUNDS = {"whoosh": whoosh, "pop": pop, "boing": boing, "ding": ding, "scratch": scratch}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("out", type=Path, help="thư mục ghi <tên>.mp3")
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        x = make()
        x = x / (np.abs(x).max() or 1) * 0.89
        pcm = (x * 32767).astype("<i2").tobytes()
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ac", "1", "-ar", str(SR), "-i", "-",
             "-c:a", "libmp3lame", "-b:a", "128k", str(args.out / f"{name}.mp3")],
            input=pcm,
            check=True,
        )
    print(f"Đã tạo {len(SOUNDS)} SFX -> {args.out}/")


if __name__ == "__main__":
    main()

# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=2"]
# ///
"""Tổng hợp nhạc nền vui tươi bằng code -> MP3 (bản quyền thuộc về kênh, không dính Content ID).

    uv run tools/music/make_loop.py packages/video/public/music/sunny-reef.mp3 --seed 1

Phong cách: marimba + bass gảy + shaker nhẹ, tiến trình hợp âm I–V–vi–IV, lặp liền mạch.
Đổi --seed / --bpm / --key để ra bản khác.
"""

import argparse
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def freq(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def marimba(f: float, dur: float) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 7.0) * (1 - np.exp(-t * 400))
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 25)
    return tone * env


def bass(f: float, dur: float) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 4.0) * (1 - np.exp(-t * 300))
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2 * t)) * env


def shaker(dur: float, rng: np.random.Generator) -> np.ndarray:
    n = int(SR * dur)
    noise = rng.standard_normal(n)
    noise = np.diff(noise, prepend=0)  # lọc thông cao đơn giản -> tiếng "xẹt" sáng
    t = np.arange(n) / SR
    return noise * np.exp(-t * 60) * 0.25


def add(buf: np.ndarray, sig: np.ndarray, at: float, gain: float) -> None:
    i = int(at * SR)
    end = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:end] += sig[: end - i] * gain


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("out", type=Path)
    p.add_argument("--bpm", type=float, default=104)
    p.add_argument("--key", default="C")
    p.add_argument("--bars", type=int, default=32)
    p.add_argument("--seed", type=int, default=1)
    args = p.parse_args()

    rng = np.random.default_rng(args.seed)
    root = 60 + NOTE[args.key[0].upper()]
    beat = 60 / args.bpm
    progression = [0, 4, 5, 3]  # I V vi IV (bậc trong gam trưởng)
    total = args.bars * 4 * beat
    left = np.zeros(int(SR * (total + 2)))
    right = np.zeros_like(left)

    # Giai điệu ngẫu nhiên nhưng cố định theo seed, đi trên các nốt của hợp âm
    pattern = rng.choice([0, 1, 2, 1, 2, 0, 2, 1], size=8)
    for bar in range(args.bars):
        degree = progression[bar % 4]
        chord = [root + MAJOR[(degree + k) % 7] + 12 * ((degree + k) // 7) for k in (0, 2, 4)]
        t0 = bar * 4 * beat
        add(left, bass(freq(chord[0] - 24), beat * 1.5), t0, 0.55)
        add(right, bass(freq(chord[0] - 24), beat * 1.5), t0, 0.55)
        add(left, bass(freq(chord[0] - 17), beat), t0 + 2 * beat, 0.35)
        add(right, bass(freq(chord[0] - 17), beat), t0 + 2 * beat, 0.35)
        for step in range(8):  # móc giai điệu nốt móc đơn
            if bar % 2 and step in (3, 7):
                continue
            note = chord[pattern[step]] + (12 if step == 6 and bar % 4 == 3 else 0)
            pan = 0.5 + 0.3 * np.sin(step)
            sig = marimba(freq(note), beat * 1.2)
            at = t0 + step * beat / 2
            add(left, sig, at, 0.32 * (1 - pan) * 2)
            add(right, sig, at, 0.32 * pan * 2)
        for step in range(8):  # shaker nhịp phụ
            g = 0.5 if step % 2 else 0.2
            add(left, shaker(0.12, rng), t0 + step * beat / 2, g)
            add(right, shaker(0.12, rng), t0 + step * beat / 2 + 0.006, g)

    # Echo nhẹ cho đầy đặn, rồi cuộn phần đuôi về đầu để lặp không bị hụt
    delay = int(beat * 0.75 * SR)
    for ch in (left, right):
        ch[delay:] += ch[:-delay] * 0.22
    n = int(total * SR)
    stereo = np.stack([left, right], axis=1)
    loop = stereo[:n].copy()
    loop[: len(stereo) - n] += stereo[n:]
    loop /= np.abs(loop).max() / 0.8

    pcm = (loop * 32767).astype("<i2").tobytes()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", "160k", str(args.out)],
        input=pcm,
        check=True,
    )
    print(f"Xong: {args.out} ({total:.1f}s, lặp liền mạch)")


if __name__ == "__main__":
    main()

# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=11"]
# ///
"""Xoá nền trắng/đơn sắc của ảnh nhân vật tải từ Gemini -> PNG nền trong suốt.

    uv run tools/cut_bg.py ~/Downloads/gemini_nhanvat.png public/character/body.png

Cách làm: tô loang (flood fill) từ 4 góc ảnh, nên nhân vật cần có viền đậm
và nền một màu (xem GEMINI_PROMPTS.md). Không cần model AI, chạy tức thì.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

TRANSPARENT = (0, 0, 0, 0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--thresh", type=int, default=40, help="độ lệch màu nền cho phép (tăng nếu nền còn sót)")
    parser.add_argument("--max-width", type=int, default=1200)
    args = parser.parse_args()

    img = Image.open(args.input).convert("RGBA")
    w, h = img.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if img.getpixel(corner)[3] != 0:
            ImageDraw.floodfill(img, corner, TRANSPARENT, thresh=args.thresh)

    bbox = img.getchannel("A").getbbox()
    if not bbox:
        raise SystemExit("Ảnh bị xoá sạch — giảm --thresh hoặc kiểm tra viền nhân vật")
    img = img.crop(bbox)
    if img.width > args.max_width:
        img = img.resize((args.max_width, round(img.height * args.max_width / img.width)), Image.LANCZOS)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    img.save(args.output)
    print(f"Xong: {args.output} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()

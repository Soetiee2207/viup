# @viup/video — engine video Short hoạt hình 2D

**Scene engine:** từ `spec.json` (VideoSpec) ra MP4 1080×1920.
- Mỗi câu chia 1–3 *beat* (~1–2 giây), mỗi beat là một cảnh kín màn hình.
- Nền động theo cảm xúc; máy quay zoom và lắc.
- Đồ vật (icon Fluent Emoji Flat, MIT) có mắt và miệng biết nhép.
- Chú cua tham gia trong cảnh.
- SFX tự tổng hợp, tiêu đề hook đầu video, phụ đề khớp từng từ.
- Ảnh bìa (`src/Cover.tsx`): cua + `title` của spec, đặt ở 2 khung hình đầu (TikTok/YouTube lấy khung đầu làm thumbnail) và xuất thêm `<tên video>.jpg`.
- Có thể có **nhân vật khách** (`guest`) nói chuyện với cua bằng giọng riêng (video kể chuyện).

Kịch bản do `packages/brain` sinh (Gemini API free tier). Chi phí dựng video 0đ:

| Phần | Công cụ | Chi phí |
|---|---|---|
| Vẽ nhân vật cua | Gemini app (gói Pro, làm tay một lần) | trong gói Pro |
| Giọng đọc tiếng Việt | [edge-tts](https://github.com/rany2/edge-tts) (giọng Microsoft) | miễn phí, không cần key |
| Hoạt hình + dựng video | [Remotion](https://www.remotion.dev) (React → MP4) | miễn phí cho cá nhân/nhóm ≤ 3 người |

## Cài đặt

Cài từ thư mục gốc repo: `npm install`. Các lệnh dưới chạy trong `packages/video/`.

## Chạy

```bash
npm run render -- spec.json                    # giọng đọc + icon + SFX -> out/short.mp4
npm run stills -- spec.json                    # 1 ảnh/cảnh + out/stills/sheet.png (xem nhanh, ~30s)
npm run stills -- spec.json --frames 0,45,90   # khung hình cụ thể
npm run voice -- spec.json                     # chỉ tạo public/voice.wav + manifest.json (cho Studio)
npm run studio                                 # xem trước trong trình duyệt
```

Giọng đọc chỉ tạo lại khi **lời thoại**, người nói hoặc giọng khách đổi; sửa beat/hình/nhãn thì chỉ vá manifest. Ép tạo lại: `--force-voice`. Đổi giọng/tốc độ: `--voice vi-VN-HoaiMyNeural --rate +10%` (mặc định giọng nam NamMinh +16%).

Kịch bản cũ `script.txt`: render thẳng file .txt, hoặc chuyển sang spec: `uv run ../../tools/tts/make_voice.py script.txt --to-spec spec.json`.

## spec.json

```jsonc
{
  "hook": "Bạn có biết?",              // tiêu đề to 2 giây đầu (cảnh đầu tự là cua cận mặt)
  "music": "music/sunny-reef.mp3",     // tuỳ chọn
  "guest": {"icon": "droplet", "name": "Giọt Mưa", "voice": "nu"},   // tuỳ chọn: nhân vật khách
  "lines": [
    {
      "text": "Bạch tuộc có tới ba trái tim!",
      "emotion": "ngacnhien",          // vui | buon | ngacnhien | binhthuong
      "speaker": "crab",               // crab (mặc định) | guest
      "beats": [                        // tuỳ chọn; bỏ trống = engine tự chia, dùng "props"/"label" của câu
        {"layout": "crab-closeup"},
        {"from": "ba trái tim", "layout": "count", "props": [{"icon": "anatomical-heart", "count": 3}], "label": "3 TRÁI TIM"}
      ]
    }
  ]
}
```

**Nhân vật khách** (`guest`): `icon` = tên icon, `name` = bảng tên vàng (≤ 14 ký tự), `voice`:

| voice | Giọng (edge-tts) |
|---|---|
| `nu` | HoaiMy +12% |
| `be` | HoaiMy +18%, cao giọng +35Hz (trẻ con) |
| `tram` | NamMinh +6%, trầm −28Hz |

Video có khách sẽ hiện phụ đề trong ô màu: tím là cua, đỏ là khách. Câu của khách, hoặc beat có layout `dialogue`, dựng thành cảnh hai nhân vật. Một phần câu của cua không có hình cũng được dựng thành cảnh này.

Trường của beat (đều tuỳ chọn, thiếu thì engine tự chọn theo cảm xúc và số hình):

| Trường | Giá trị |
|---|---|
| `from` | cụm từ mở đầu beat; bỏ trống = cắt ở dấu câu / chỗ ngắt giọng gần mốc chia đều |
| `layout` | `crab-closeup` (cua cận mặt phản ứng) · `crab-presents` (cua cạnh đồ vật) · `object-hero` (đồ vật to, cua nhỏ ở góc) · `versus` (2 đồ vật đối đầu — chỉ khi ghi rõ) · `count` (đếm, số chạy lên) · `dialogue` (khách ở trên bên phải, cua ở dưới bên trái; ai đang nói thì to hơn và nghiêng người) |
| `props` | `[{"icon": "coin", "count": 1, "face": true}]` — `face` mặc định bật, trừ icon vốn có mặt (con vật, người) |
| `label` | nhãn chữ to ở trên |
| `bg` | `burst` (tia sáng xoay) · `speedlines` (nhấn mạnh) · `bokeh` (bình thường) · `gloom` (buồn, mưa) |
| `transition` | `slide` · `zoom` · `flash` · `spin` · `cut` |
| `sfx` | `whoosh` · `pop` · `boing` · `ding` · `scratch` · `none` — thay SFX mở đầu beat (pop/ding theo icon và nhãn vẫn tự có) |

Tìm tên icon: `npm run icons -- search <từ khoá>`. Mặt đồ vật lệch thì chỉnh bảng `FACES` trong `src/Prop.tsx`.

## Cấu trúc

```
spec.json             kịch bản mẫu (VideoSpec)
scripts/render.ts     spec -> giọng đọc -> icon -> SFX/nhạc -> MP4 hoặc stills
scripts/icons.ts      tìm icon + trích icon dùng trong video ra public/icons/
src/timeline.ts       chia câu thành beat theo mốc từng từ, chọn mặc định (bố cục, nền, chuyển cảnh, SFX)
src/Short.tsx         ghép cảnh + chuyển cảnh, hook, phụ đề, nhạc + ducking, SFX, ảnh bìa ở khung đầu
src/Cover.tsx         ảnh bìa: câu hỏi (title) + cua (+ nhân vật khách)
src/Scene.tsx         một cảnh: máy quay (Ken Burns, zoom-punch, lắc) + 6 bố cục (kể cả dialogue) + nhãn
src/Background.tsx    nền động burst / speedlines / bokeh / gloom, màu theo cảm xúc
src/Prop.tsx          đồ vật biết nói (mắt, miệng, chớp mắt) + bảng toạ độ mặt icon
src/Character.tsx     cua: thở, chớp mắt, nhép miệng, nhảy/lắc theo cảm xúc
src/Subtitle.tsx      phụ đề nhóm từ của beat, tô vàng từ đang đọc (video kể chuyện: ô màu theo người nói)
../../tools/tts/make_voice.py   giọng đọc (giọng riêng cho khách) + mốc từng từ (WordBoundary) + độ to từng khung hình
../../tools/music/make_sfx.py   SFX tự tổng hợp
../../tools/cut_bg.py           xoá nền trắng của ảnh nhân vật từ Gemini
```

## Nhạc nền & SFX

- Mặc định: `public/music/sunny-reef.mp3`, **tự tổng hợp bằng code**, nên bản quyền thuộc kênh và không dính Content ID (`render` tự tạo nếu thiếu). Tạo bản khác: `uv run tools/music/make_loop.py packages/video/public/music/<tên>.mp3 --seed 7 --bpm 110 --key D`.
- Muốn nhạc hay hơn: tải bài từ **YouTube Audio Library** (studio.youtube.com → Thư viện âm thanh, lọc *Không yêu cầu ghi công*), bỏ vào `public/music/`, rồi ghi vào `"music"` trong spec.
- Nhạc tự **giảm khi cua nói** (ducking), có fade-in và fade-out; chỉnh độ to bằng prop `musicVolume`.
- SFX (`public/sfx/*.mp3`) tổng hợp bằng `tools/music/make_sfx.py`, `render` tự tạo nếu thiếu; chỉnh độ to bằng prop `sfxVolume`.

## Giới hạn hiện tại

- Cảnh vẫn là nền động + icon, chưa có bối cảnh vẽ riêng cho từng cảnh như kênh hoạt hình vẽ tay.
- Miệng nhép theo **độ to** giọng (mở/đóng), chưa theo khẩu hình từng âm.
- Càng cua chưa cử động riêng (cần ảnh lớp càng riêng, xem docs/GEMINI_PROMPTS.md).
- Toạ độ mặt mới chỉnh tay cho ~20 icon; icon khác dùng vị trí mặc định (giữa, hơi cao).

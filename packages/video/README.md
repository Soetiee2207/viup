# @viup/video — engine video Short hoạt hình 2D

Bố cục "người dẫn chương trình": **bảng minh hoạ** (icon Fluent Emoji Flat, MIT) ở trên, **phụ đề** ở giữa, **chú cua** dẫn chuyện ở dưới (chớp mắt, nhép miệng theo giọng, đổi biểu cảm). Xuất MP4 1080×1920.

Chi phí 0đ ngoài gói Google AI Pro:

| Phần | Công cụ | Chi phí |
|---|---|---|
| Kịch bản, vẽ nhân vật, ảnh nền | Gemini app (gói Pro, làm tay một lần) | trong gói Pro |
| Giọng đọc tiếng Việt | [edge-tts](https://github.com/rany2/edge-tts) (giọng Microsoft) | miễn phí, không cần key |
| Hoạt hình + dựng video | [Remotion](https://www.remotion.dev) (React → MP4) | miễn phí cho cá nhân/nhóm ≤ 3 người |

## Cài đặt

Cài từ thư mục gốc repo: `npm install`. Các lệnh dưới chạy trong `packages/video/`.

## Chạy

```bash
npm run voice    # script.txt -> public/voice.wav + public/manifest.json
npm run studio   # xem trước & chỉnh trong trình duyệt
npm run render   # xuất out/short.mp4
```

Đổi giọng/tốc độ: `uv run ../../tools/tts/make_voice.py script.txt --out public --voice vi-VN-HoaiMyNeural --rate +15%` (mặc định là giọng nam NamMinh)

Chưa có ảnh nhân vật thì video dùng nhân vật mẫu (bạch tuộc tím). Muốn dùng nhân vật riêng vẽ bằng Gemini: xem **[docs/GEMINI_PROMPTS.md](../../docs/GEMINI_PROMPTS.md)**.

## Cấu trúc

```
script.txt            kịch bản: [cảm xúc] {icon, icon xN | NHÃN} lời thoại
scripts/icons.ts      tìm icon (npm run icons -- search tim) + trích icon dùng trong video
src/Stage.tsx         bảng minh hoạ: icon bật vào, lơ lửng, nhãn chữ to
../../tools/tts/make_voice.py   tạo giọng đọc + thời điểm từng câu + độ to từng khung hình
../../tools/cut_bg.py           xoá nền trắng của ảnh nhân vật từ Gemini
src/Short.tsx         bố cục video, nền, tuỳ chỉnh (props)
src/Character.tsx     nhân vật: thở, chớp mắt, nhép miệng, nảy/nhảy/lắc theo cảm xúc
src/Subtitle.tsx      phụ đề tô vàng từ đang đọc
```

## Giới hạn hiện tại

- Từ đang đọc trên phụ đề được **ước lượng** theo số ký tự, chưa khớp tuyệt đối.
- Miệng nhép theo **độ to** giọng (mở/đóng), chưa theo khẩu hình từng âm.
- Một nhân vật; chưa có nhạc nền; icon minh hoạ khai báo tay trong script.txt (Phase 2 do AI chọn).

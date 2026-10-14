# Prompt dùng với Gemini (gói Google AI Pro, qua web/app — không tốn API)

Mẹo chung: dùng model ảnh mới nhất trong Gemini app, giữ nguyên **một cuộc trò chuyện** cho cùng một nhân vật để Gemini nhớ phong cách.

---

## 1. Kịch bản → `spec.json`

(Phase 2 sẽ tự động bước này qua Gemini API.)

```
Bạn là biên kịch video ngắn (YouTube Shorts/TikTok) tiếng Việt, nhân vật dẫn chuyện là một chú cua.
Chủ đề: <DÁN CHỦ ĐỀ / THÔNG TIN ĐÃ TÌM ĐƯỢC VÀO ĐÂY>

Viết kịch bản 20–40 giây, xuất ra DUY NHẤT một JSON theo mẫu:
{"hook": "Bạn có biết?", "lines": [
  {"text": "Bạch tuộc có tới ba trái tim!", "emotion": "ngacnhien", "beats": [
    {"layout": "crab-closeup"},
    {"from": "ba trái tim", "layout": "count", "props": [{"icon": "anatomical-heart", "count": 3}], "label": "3 TRÁI TIM"}
  ]}
]}
Yêu cầu:
- "hook": 2–4 từ gây tò mò. Câu đầu là hook trong 3 giây. 5–9 câu, mỗi câu tối đa 18 từ, văn nói tự nhiên. Câu cuối kêu gọi theo dõi.
- "emotion" chỉ dùng: vui, buon, ngacnhien, binhthuong.
- Mỗi câu 1–3 beat (~1,5 giây/beat). "from" = cụm từ trong câu nơi beat bắt đầu (bỏ trống ở beat đầu).
- "layout": crab-closeup, crab-presents, object-hero, versus (chỉ khi so sánh 2 thứ), count (khi có con số).
- "icon": tên emoji tiếng Anh viết thường nối gạch ngang (vd octopus, red-heart, water-wave).
- "label": nhãn ngắn VIẾT HOA, tối đa 18 ký tự, không bắt buộc.
```

Lưu thành `packages/video/spec.json`, rồi chạy `npm run stills -w @viup/video` để xem nhanh, `npm run render -w @viup/video` để ra MP4. Nếu báo icon không tồn tại, tìm tên đúng bằng `npm run icons -w @viup/video -- search <từ khoá>`.

---

## 2. Nhân vật → `public/character/body.png`

**Quan trọng:** yêu cầu nhân vật **không có mắt, không có miệng**. Code sẽ tự vẽ mắt chớp và miệng nhép theo giọng.

```
Vẽ một nhân vật hoạt hình 2D phong cách flat vector, dễ thương, đơn giản:
<MÔ TẢ NHÂN VẬT, vd: một chú mèo cam mập, mặc áo hoodie xanh>

Yêu cầu bắt buộc:
- Khuôn mặt TRỐNG: KHÔNG có mắt, KHÔNG có miệng, KHÔNG có mũi (chỉ có má hồng nếu muốn).
- Nhìn thẳng chính diện, đứng thẳng, toàn thân, ở giữa khung hình.
- Viền đen đậm, màu phẳng, không đổ bóng, không gradient.
- Nền trắng trơn hoàn toàn, không có vật thể hay chữ nào khác.
- Tỉ lệ khung hình vuông 1:1.
```

Muốn thêm nhân vật khác cùng phong cách: *"Vẽ thêm một nhân vật mới cùng phong cách y hệt: …"*.

### Mascot chính: chú cua Cự Giải

```
Vẽ mascot cho một kênh video ngắn: một chú cua nhỏ dễ thương, phong cách chibi flat vector 2D.
- Thân tròn bầu, màu đỏ cam ấm, có 2 càng to tròn trịa và 6 chân ngắn.
- Hai mắt nằm trên 2 cuống mắt ngắn dựng đứng; mỗi đầu cuống là một quả cầu TRẮNG TRƠN,
  KHÔNG có con ngươi, KHÔNG có đồng tử.
- Trên thân KHÔNG có miệng, KHÔNG có mũi (chỉ có 2 má hồng nhạt).
- Nhìn thẳng chính diện, đối xứng, 2 càng giơ nhẹ sang hai bên, không che thân.
- Viền đen đậm, màu phẳng, không đổ bóng, không gradient.
- Nền trắng trơn hoàn toàn, không vật thể, không chữ. Khung hình vuông 1:1.
```

Khi căn mặt trong Studio: đặt `eyeLeftX/eyeRightX/eyeY` vào **giữa 2 quả cầu mắt** (code vẽ con ngươi lên đó), `mouthY` ở giữa thân.

Lớp càng riêng (để code vẫy/kẹp càng — Phase 1 mới dùng tới), hỏi tiếp trong cùng cuộc trò chuyện:

```
Vẽ lại đúng chú cua này nhưng KHÔNG có 2 càng (bỏ hẳn càng, giữ nguyên mọi thứ khác, cùng góc nhìn và kích thước).
```
```
Chỉ vẽ riêng chiếc càng BÊN PHẢI của chú cua này (phía bên phải người xem), cùng phong cách, nền trắng trơn.
```

Tải ảnh về rồi xoá nền:

```bash
uv run tools/cut_bg.py ~/Downloads/<ảnh>.png packages/video/public/character/body.png
```

---

## 3. Ảnh nền (tuỳ chọn) → `public/background.png`

```
Vẽ một bối cảnh nền 2D phong cách flat vector, cùng phong cách với nhân vật ở trên:
<MÔ TẢ, vd: đáy biển với san hô và rong biển>
- Tỉ lệ dọc 9:16.
- KHÔNG có nhân vật, KHÔNG có chữ.
- Phần giữa khung hình để trống/đơn giản (nhân vật sẽ đứng ở đó).
- Màu dịu, hơi mờ để nhân vật và phụ đề nổi bật.
```

---

## 4. Căn mắt & miệng vào nhân vật

1. `npm run studio -w @viup/video` → mở trình duyệt.
2. Ở bảng **Props** bên phải: đặt `characterImage` = `character/body.png` (và `backgroundImage` = `background.png` nếu có).
3. Chỉnh `face`: toạ độ là tỉ lệ 0–1 theo ảnh nhân vật (`0.5` = chính giữa). Kéo tới khi mắt/miệng nằm đúng chỗ.
4. Bấm **Save** để lưu thành mặc định (ghi vào `src/Root.tsx`), rồi `npm run render -w @viup/video`.

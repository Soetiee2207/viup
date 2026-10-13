# Prompt dùng với Gemini (gói Google AI Pro, qua web/app — không tốn API)

Mẹo chung: dùng model ảnh mới nhất trong Gemini app, giữ nguyên **một cuộc trò chuyện** cho cùng một nhân vật để Gemini nhớ phong cách.

---

## 1. Kịch bản → `script.txt`

```
Bạn là biên kịch video ngắn (YouTube Shorts/TikTok) tiếng Việt.
Chủ đề: <DÁN CHỦ ĐỀ / THÔNG TIN ĐÃ TÌM ĐƯỢC VÀO ĐÂY>

Viết kịch bản dài 20–40 giây, do một nhân vật hoạt hình kể.
Yêu cầu:
- Câu đầu tiên là hook gây tò mò trong 3 giây.
- 5–9 câu, mỗi câu tối đa 18 từ, văn nói tự nhiên, dễ hiểu.
- Câu cuối kêu gọi theo dõi/bình luận.
- Đầu mỗi câu gắn đúng MỘT nhãn cảm xúc: [vui] [buon] [ngacnhien] [binhthuong]
- Chỉ in ra các câu, mỗi câu một dòng, không đánh số, không giải thích.
```

Dán kết quả vào `script.txt`, rồi chạy `npm run voice`.

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

Tải ảnh về rồi xoá nền:

```bash
npm run cutbg -- ~/Downloads/<ảnh>.png public/character/body.png
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

1. `npm run studio` → mở trình duyệt.
2. Ở bảng **Props** bên phải: đặt `characterImage` = `character/body.png` (và `backgroundImage` = `background.png` nếu có).
3. Chỉnh `face`: toạ độ là tỉ lệ 0–1 theo ảnh nhân vật (`0.5` = chính giữa). Kéo tới khi mắt/miệng nằm đúng chỗ.
4. Bấm **Save** để lưu thành mặc định (ghi vào `src/Root.tsx`), rồi `npm run render`.

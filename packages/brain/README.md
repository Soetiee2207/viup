# @viup/brain — từ chủ đề ra kịch bản (Phase 2)

```bash
npm run make -- "vì sao hồng hạc có màu hồng"          # -> packages/video/out/<id>-<slug>.mp4
npm run make -- "3 cung dễ ghen nhất" --format zodiac  # format không cần nguồn
npm run make -- "chủ đề" --no-render                   # chỉ ra kịch bản: packages/video/out/specs/<id>-<slug>.json
npm run make -- "chủ đề" --stills                      # kịch bản + ảnh xem nhanh từng cảnh
npm run make -- "chủ đề" --source ghi-chu.txt          # tự đưa văn bản nguồn thay cho Wikipedia
npm run make -- --usage                                # đã dùng bao nhiêu lượt Gemini hôm nay
```

Cần `GEMINI_API_KEY=...` trong `.env` ở thư mục gốc (docs/SETUP_APIS.md mục 1).

## Luồng

1. **Nguồn** (`source.ts`, chỉ format `fun-fact`): model lite đoán tên bài Wikipedia + từ khoá → lấy bài tiếng Việt, bài tiếng Anh, và 1 bài tìm theo cụm cụ thể; bài dài chỉ giữ phần mở đầu + các mục chứa từ khoá.
2. **Viết** (`write.ts`): Gemini trả JSON theo schema: tiêu đề, hook, câu thoại, beat, `facts` (thông tin + câu trích nguyên văn từ nguồn làm bằng chứng), `covered` (nguồn có đủ thông tin không — không đủ thì bỏ chủ đề luôn).
3. **Kiểm tra bằng code** (`validate.ts`): số câu, độ dài (80–130 chữ ≈ 25–40 giây), `from` có trong câu, nhãn ngắn, versus/count hợp lệ. Tự sửa: icon sai tên → icon gần nhất; câu dài chỉ 1 beat → để engine tự chia.
4. **QA** (`qa.ts`): lượt Gemini thứ hai chấm 1–5: `topic` (đúng chủ đề), `accuracy` (khớp nguồn, chống bịa), `safety`, `originality` (không chép nguyên văn), `hook`, `clarity`. Ngưỡng đạt ở `PASS`, do code quyết định.
5. Không đạt → viết lại kèm danh sách lỗi, tối đa 2 lần; vẫn không đạt → bỏ chủ đề (`ideas.status = rejected`).
6. Lưu DB: `ideas`, `scripts` (spec + báo cáo QA mọi lần viết), `videos`; render bằng `packages/video/scripts/render.ts`.

## Hạn mức Gemini (`gemini.ts`)

- Model chính `gemini-flash-latest` (free tier: **20 lượt/ngày**), dự phòng `gemini-flash-lite-latest`. Mỗi video tốn 3–7 lượt.
- Mỗi lượt gọi ghi vào bảng `api_calls`. Đủ lượt/phút → tự chờ; hết lượt/ngày (đếm của mình hoặc Google báo 429) → chuyển model dự phòng tới khi reset (0h giờ Thái Bình Dương ≈ 14–15h giờ VN).
- Quá tải (503) → thử lại 1 lần rồi chuyển model dự phòng.
- Chỉnh trong `.env`: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_RPM` (mặc định 8), `GEMINI_RPD` (20), `GEMINI_FALLBACK_RPD` (200).

## Thêm format mới

Thêm 1 mục vào `FORMATS` trong `src/formats.ts`: `needsSource`, hướng dẫn cho người viết, tiêu chí accuracy cho QA.

## Giới hạn hiện tại

- Chỉ có nguồn Wikipedia; chủ đề Wikipedia không nói tới thì bị bỏ (Phase 3 thêm nguồn khác).
- Model lite viết kém hơn (hay ngắn, ít chia beat); khi engine tự chia cảnh có thể cắt giữa từ ghép.

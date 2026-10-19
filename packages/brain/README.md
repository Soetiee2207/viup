# @viup/brain: từ chủ đề ra kịch bản

```bash
npm run make -- "vì sao mèo thích hộp giấy"            # -> videos/<ngày đăng>/N-slug.mp4 + N-slug.txt (caption)
npm run make -- "3 cung dễ ghen nhất" --format zodiac  # format không cần nguồn
npm run make -- "chủ đề" --date 2026-10-21             # xếp vào ngày đăng cụ thể (mặc định: ngày gần nhất còn thiếu video)
npm run make -- "chủ đề" --no-render                   # chỉ ra kịch bản: packages/video/out/specs/<id>-<slug>.json
npm run make -- "chủ đề" --stills                      # kịch bản + ảnh xem nhanh từng cảnh
npm run make -- "chủ đề" --source ghi-chu.txt          # tự đưa văn bản nguồn thay cho Wikipedia
npm run make -- --auto [--days N] [--ahead N]          # tự chọn chủ đề, làm đủ video/ngày cho N ngày
npm run make -- --ideas [--discover]                   # xem (hoặc sinh thêm) kho ý tưởng
npm run make -- --usage                                # đã dùng bao nhiêu lượt Gemini hôm nay
npm run recaption [-- YYYY-MM-DD]                      # viết lại caption/hashtag cho video đã làm
```

Cần `GEMINI_API_KEY=...` trong `.env` ở thư mục gốc (docs/SETUP_APIS.md mục 1). Số video/ngày: `VIUP_PER_DAY` trong `.env`, hoặc cài trong app (mặc định 3).

## Luồng

1. **Ý tưởng** (`ideas.ts`, khi `--auto`): model lite brainstorm 12 ý tưởng cho mỗi format, theo nhóm chủ đề xoay vòng mỗi ngày (fun-fact ưu tiên bí ẩn đời thường: đồ ăn, cơ thể, đồ trong nhà, con vật quen thuộc), rồi tự chấm điểm. Code lọc bỏ ý tưởng không an toàn hoặc khó kiểm chứng, và chống trùng với 300 ý tưởng gần nhất. Ý tưởng thêm tay trên app có điểm 99 nên được làm trước.
2. **Nguồn** (`source.ts`, chỉ `fun-fact`): model lite đoán tên bài Wikipedia và từ khoá, rồi lấy bài tiếng Việt, bài tiếng Anh và 1 bài tìm theo cụm cụ thể. Bài dài chỉ giữ phần mở đầu và các mục chứa từ khoá.
3. **Viết** (`write.ts` + phần `writer` trong `formats.ts`): Gemini trả JSON theo schema, gồm:
   - `title` và `hook`;
   - `guest` (nhân vật khách: icon, tên, giọng `nu` / `tram` / `be`), chỉ có ở format kể chuyện;
   - `lines`: mỗi câu có `speaker` (`crab` / `guest`), `emotion` và `beats`;
   - `subject` (tên, tên khoa học, ở đâu);
   - `facts` (thông tin kèm câu trích nguyên văn từ nguồn làm bằng chứng);
   - `covered`: nguồn có đủ thông tin không. Không đủ thì bỏ chủ đề ngay.
4. **Kiểm tra bằng code** (`validate.ts`):
   - Kiểm: 4–15 câu, 80–190 chữ; `from` có trong câu; nhãn ngắn; versus/count hợp lệ; khách nói ít nhất 2 câu.
   - Tự sửa: icon sai tên thì đổi sang icon gần nhất; câu dài chỉ có 1 beat thì để engine tự chia; câu `guest` khi không có khách thì chuyển cho cua nói.
5. **QA** (`qa.ts`): lượt Gemini thứ hai chấm 1–5 theo 7 tiêu chí. Code quyết định đạt hay không theo ngưỡng `PASS`. Các tiêu chí:
   - `topic`: đúng chủ đề;
   - `accuracy`: khớp nguồn, chống bịa (được đổi đơn vị và cho nhân vật "diễn");
   - `essentials`: có đủ thông tin cơ bản theo format. Fun-fact phải có tên, ở đâu và một con số; zodiac phải gọi tên cung;
   - `safety`;
   - `originality`: không chép nguyên văn nguồn;
   - `hook`;
   - `clarity`.
6. Không đạt thì viết lại kèm danh sách lỗi (tổng cộng tối đa 3 lần viết). Vẫn không đạt thì bỏ chủ đề (`ideas.status = rejected`).
7. **Caption** (`captions.ts`): model lite gợi ý 3 cụm từ khoá và 1 câu hỏi kéo bình luận; code chuyển thành hashtag (không dấu, viết liền). File `.txt` gồm:
   - tiêu đề YouTube (kèm `#Shorts`);
   - caption TikTok/Facebook: tiêu đề + câu hỏi, rồi tối đa 7 hashtag (3 theo chủ đề + 2 của ngách + `#xuhuong #crabvibe`);
   - mô tả YouTube: lời thoại, dòng `📌 tên (tên khoa học) — ở đâu` và 3 hashtag.
8. Lưu DB (`ideas`, `scripts` gồm spec + báo cáo QA mọi lần viết, `videos`) rồi render bằng `packages/video/scripts/render.ts`.

## Hạn mức Gemini (`gemini.ts`)

- Model chính là `gemini-flash-latest` (free tier: **20 lượt/ngày**), dự phòng `gemini-flash-lite-latest`. Mỗi video tốn khoảng 3–8 lượt.
- Mỗi lượt gọi được ghi vào bảng `api_calls`.
- Khi chạm giới hạn:
  - Đủ lượt/phút thì tự chờ.
  - Hết lượt/ngày (theo đếm của tool, hoặc Google báo 429) thì chuyển sang model dự phòng tới khi reset (0h giờ Thái Bình Dương ≈ 14–15h giờ VN).
  - Quá tải (503) thì thử lại 1 lần rồi chuyển model dự phòng.
- Chỉnh trong `.env`: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_RPM` (mặc định 8), `GEMINI_RPD` (20), `GEMINI_FALLBACK_RPD` (200).
- **Schema JSON không được quá phức tạp.** Ví dụ `minItems`/`maxItems` cho `lines` làm Gemini báo lỗi 400 "invalid argument". Số câu do `validate.ts` kiểm.

## Thêm format mới

Thêm 1 mục vào `FORMATS` trong `src/formats.ts`, gồm:
- `needsSource`;
- `story` (có nhân vật khách không);
- `writer` (hướng dẫn viết: cấu trúc, số câu, số chữ);
- `accuracy` (tiêu chí chống bịa cho QA);
- `essentials` (thông tin bắt buộc phải có).

## Giới hạn hiện tại

- Chỉ có nguồn Wikipedia; chủ đề Wikipedia không nói tới thì bị bỏ.
- Model lite viết kém hơn: hay viết ngắn và ít chia beat; code tự bù một phần.

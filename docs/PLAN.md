# Kế hoạch phát triển viup (tool tự động 100%)

> Mục tiêu: máy tự chạy hằng ngày, không cần người duyệt:
> **tìm chủ đề → chọn ý tưởng → viết kịch bản → tự kiểm duyệt → giọng đọc → dựng video hoạt hình 2D → đăng → đo hiệu quả → học lại**.
> Webapp chỉ để **cấu hình và giám sát**, không có bước duyệt tay.

---

## 1. Nguyên tắc chọn công nghệ: AI ít nhất có thể

| Việc | Dùng gì | Vì sao | Chi phí |
|---|---|---|---|
| **Hoạt hình** | **Code (Remotion)**, không dùng model | Ổn định 100%, render lại giống hệt, không giới hạn | 0đ |
| Viết kịch bản, chấm điểm ý tưởng, tự kiểm duyệt | **Gemini Flash-Lite / Flash qua API, free tier** (AI Studio) | Rẻ nhất, đủ tốt cho văn bản ngắn, output JSON | 0đ trong hạn mức free |
| Giọng đọc | edge-tts (đã có), dự phòng Gemini TTS API | Miễn phí; edge-tts có mốc thời gian **từng từ**, nên phụ đề khớp chính xác | 0đ |
| Nhân vật, nền | **Thư viện vẽ sẵn 1 lần** bằng Gemini app (gói Pro) | Tool chọn lại từ thư viện, nhân vật luôn nhất quán | trong gói Pro |
| Sự vật minh hoạ (tim, tiền, đồng hồ…) | **Bộ icon/emoji mở**: OpenMoji, Twemoji, Iconify | LLM chỉ cần chọn từ khoá, không phải sinh ảnh | 0đ (ghi credit theo license) |
| Video AI (Veo) | **Không dùng** trong pipeline tự động | Tốn credits, chậm, khó nhất quán | — |

**Lưu ý:** gói Google AI Pro **không có API**, nên trong tool tự động nó chỉ dùng được ở bước chuẩn bị thư viện nhân vật và nền (làm tay một lần). Mọi thứ chạy hằng ngày đi qua **Gemini API free tier**. Nếu vượt hạn mức free, bản Flash-Lite trả phí cũng chỉ tốn khoảng vài nghìn đồng mỗi video.

**Ước tính chi phí với 3 video/ngày:** khoảng 0đ nếu chạy trên máy nhà. Thuê VPS 2–4 vCPU để chạy 24/7 thì khoảng 5–10 USD/tháng.

---

## 1b. Nhân vật chủ đạo: con cua (Cự Giải)

- Mascot chính của kênh là **một chú cua** (chủ kênh cung Cự Giải). Đây là nhận diện thương hiệu, xuất hiện trong mọi video.
- **Thiết kế cho hoạt hình cắt ghép:** mắt nằm trên **cuống mắt**. Gemini vẽ quả cầu mắt trắng trơn, code vẽ con ngươi và chớp mắt; miệng do code vẽ trên thân. Hai **càng** là lớp ảnh riêng để code vẫy, kẹp, giơ lên.
- Prompt vẽ nhân vật nằm trong [`prototype/GEMINI_PROMPTS.md`](../prototype/GEMINI_PROMPTS.md). Phase 1 thêm hỗ trợ lớp càng riêng.
- Có thể thêm nhân vật phụ (sinh vật biển khác) để làm dạng hội thoại.

---

## 2. Kiến trúc

Dùng TypeScript cho hầu hết hệ thống (chung với Remotion). Python chỉ giữ cho TTS.

```
viup/
├─ apps/web/          Next.js — dashboard cấu hình & giám sát
├─ worker/            Node — lịch chạy (cron) + hàng đợi job + các bước pipeline
├─ packages/
│  ├─ core/           schema DB (SQLite + Drizzle), kiểu dữ liệu chung, cấu hình
│  ├─ brain/          gọi Gemini: chấm ý tưởng, viết kịch bản, QA (prompt + JSON schema)
│  ├─ sources/        crawler: Google Trends RSS, Reddit, RSS báo, Wikipedia, YouTube trending
│  ├─ video/          Remotion (phát triển từ prototype/): render từ VideoSpec JSON
│  └─ publish/        YouTube / Facebook / TikTok uploader
├─ tools/tts/         make_voice.py (edge-tts, mốc thời gian từng từ)
├─ assets/            thư viện nhân vật, nền, nhạc (tạo 1 lần)
└─ data/              viup.db, video đã render
```

- **Hàng đợi job:** bảng `jobs` trong SQLite, có `status`, `attempts`, `run_after`. Không cần Redis. Mỗi bước pipeline là một job, lỗi thì tự thử lại có backoff.
- **Thứ tự dữ liệu:** `Channel` (ngách, giọng, nhân vật, lịch đăng) → `Idea` → `Script` → `Video` → `Post` → `Metrics`.
- **VideoSpec (JSON):** hợp đồng giữa phần "não" (brain) và phần dựng video. LLM sinh ra spec, Remotion render spec. Tách như vậy để test riêng từng phía.

```jsonc
{
  "character": "octopus",
  "background": "ocean",
  "music": "calm-01",
  "lines": [
    {
      "text": "Bạn có biết bạch tuộc có 3 trái tim?",
      "emotion": "ngacnhien",
      "props": [{"icon": "heart", "count": 3, "anim": "pop"}]
    }
  ],
  "title": "...",
  "description": "...",
  "hashtags": ["..."]
}
```

---

## 3. Lộ trình (mỗi phase ≈ 1–2 phiên code)

### Phase 0 — Khung dự án
- Chuyển sang monorepo (npm workspaces), đưa `prototype/` vào `packages/video`.
- SQLite + Drizzle, schema các bảng ở trên. Viết `CLAUDE.md` mô tả kiến trúc và lệnh chạy.
- **Đăng ký ngay** API YouTube, TikTok, Facebook và gửi audit, vì phải chờ duyệt lâu (xem mục 4).
- ✅ Xong khi: `npm run dev` chạy được web và worker rỗng; DB được tạo.

### Phase 1 — Video engine v2 (từ VideoSpec ra MP4)
- Phụ đề khớp **từng từ** nhờ WordBoundary của edge-tts.
- **Props:** icon xuất hiện theo câu với các hiệu ứng có sẵn (pop, slide, shake, đếm số, mũi tên chỉ).
- Nhiều nhân vật (hội thoại 2 người), đổi nền theo đoạn, nhạc nền tự giảm âm lượng khi có lời (ducking).
- **Thư viện asset:** `assets/characters/<tên>/{body.png, face.json}`; tìm icon theo từ khoá.
- 3–5 **template bố cục** khác nhau, chọn ngẫu nhiên để video không trùng lặp.
- ✅ Xong khi: `npm run render -- spec.json` ra MP4 đúng, có snapshot test cho vài khung hình.

### Phase 2 — Brain (từ chủ đề ra VideoSpec)
- Gemini API: `writeScript(idea, channel)` trả về VideoSpec, ép output theo JSON schema.
- **QA tự động** thay cho người duyệt. Một lượt LLM thứ hai kiểm tra:
  - nội dung có khớp với nguồn crawl không (chống bịa), độ dài;
  - chủ đề cấm hoặc nhạy cảm, bản quyền (không chép nguyên văn);
  - hook có đủ mạnh không.
  - Không đạt thì viết lại tối đa 2 lần, vẫn không đạt thì bỏ ý tưởng.
- Bộ đếm hạn mức API và tự giãn tốc độ khi gần chạm free tier.
- ✅ Xong khi: `npm run make -- "chủ đề"` ra MP4 hoàn chỉnh, không chạm tay.

### Phase 3 — Sources (tìm và chọn ý tưởng)
- Các crawler như trên; chuẩn hoá về `Idea {title, summary, sourceUrl, sourceText}`.
- Chống trùng: so sánh với ý tưởng đã làm (hash + LLM so độ giống).
- LLM chấm điểm theo ngách của kênh, khả năng viral, độ an toàn; chọn top N mỗi ngày.
- ✅ Xong khi: mỗi ngày tự sinh danh sách ý tưởng đã chấm điểm.

### Phase 4 — Worker tự động end-to-end
- Cron theo `Channel.schedule` → chuỗi job discover → select → script → QA → TTS → render → (upload).
- Tự thử lại, log, cảnh báo khi lỗi liên tục (gửi tin Telegram, miễn phí).
- Tự dọn file render cũ.
- ✅ Xong khi: chạy 3 ngày liền tự ra video mỗi ngày, không can thiệp.

### Phase 5 — Webapp dashboard
- Quản lý kênh: ngách, giọng, nhân vật, lịch, số video/ngày, nút tạm dừng khẩn cấp.
- Trạng thái pipeline, danh sách video kèm player xem lại, log lỗi, mức dùng API.
- ✅ Xong khi: mọi cấu hình đều chỉnh được trên web, không phải sửa file.

### Phase 6 — Publish
- YouTube Data API (`videos.insert`), Facebook Graph API (Reels lên Page), TikTok Content Posting API.
- Bật cờ **"nội dung tạo bằng AI"** mà các API hỗ trợ; đăng đúng giờ vàng theo lịch.
- ✅ Xong khi: video tự đăng công khai trên ít nhất 1 nền tảng.

### Phase 7 — Vòng phản hồi
- Mỗi ngày kéo số liệu view, retention, like → lưu vào `Metrics`.
- Đưa chủ đề và kiểu hook hiệu quả vào prompt chấm ý tưởng và viết kịch bản.

---

## 4. Rủi ro cần biết trước

- **Đăng qua API bị giới hạn khi chưa audit:**
  - YouTube: video upload từ project API chưa được xác minh **bị khoá ở chế độ riêng tư**.
  - TikTok: client chưa audit chỉ đăng được riêng tư, hoặc gửi vào **hộp nháp** để bạn bấm đăng.
  - Vì vậy phải nộp audit từ Phase 0. Trong lúc chờ, tool vẫn sản xuất video, chỉ khâu đăng là tạm thời bán tự động.
- **Chính sách kiếm tiền:** YouTube hạn chế nội dung "sản xuất hàng loạt / lặp lại". Pipeline giảm rủi ro bằng: nhân vật riêng, nhiều template, QA chống chép, gắn nhãn AI, và không đăng quá dày (khởi đầu 1–3 video/ngày/kênh).
- **edge-tts** là API không chính thức của Microsoft, có thể đổi bất cứ lúc nào. Luôn giữ Gemini TTS làm phương án dự phòng.
- **Hạn mức free tier của Gemini** có thể thay đổi. Bộ đếm hạn mức ở Phase 2 giúp tool tự chậm lại thay vì sập.

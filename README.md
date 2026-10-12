# viup

> Webapp tự động hoá quy trình làm video ngắn cho **YouTube Shorts**, **Facebook Reels** và **TikTok**: từ tìm ý tưởng → viết kịch bản → tạo giọng đọc và hình ảnh/video bằng AI → dựng video → (sau này) tự đăng.

## Giới thiệu

viup nhắm tới người làm content video ngắn muốn giảm thời gian sản xuất nhưng vẫn giữ quyền kiểm soát nội dung. Đầu vào là dữ liệu crawl từ các nguồn trending, đầu ra là video dọc **9:16, dài 15–60 giây**, có nhân vật hoặc hình ảnh minh hoạ đủ sinh động, kèm phụ đề, nhạc nền, tiêu đề và hashtag.

## Pipeline

```
Crawl & Trend ─▶ Lọc / chọn ý tưởng ─▶ Viết kịch bản (LLM) ─▶ Giọng đọc (TTS)
                                                                   │
        Đăng ◀── Duyệt thủ công ◀── Dựng & phụ đề ◀── Hình ảnh / Video (AI)
```

## Các module dự kiến

| Module | Vai trò | Công nghệ dự kiến |
|---|---|---|
| **Nguồn dữ liệu** | Tìm chủ đề đang hot, thu thập thông tin | Google Trends, YouTube Data API, Reddit, RSS/báo, TikTok Creative Center |
| **Kịch bản** | Viết script có hook 3 giây đầu, thân bài, CTA; sinh tiêu đề, mô tả, hashtag | Gemini API |
| **Giọng đọc** | Chuyển kịch bản thành voice-over (có tiếng Việt) | Gemini TTS / Google Cloud TTS, ElevenLabs |
| **Hình ảnh / Video** | Tạo cảnh minh hoạ, nhân vật nhất quán giữa các video | Veo (video), Imagen / Gemini image; fallback ảnh stock + hiệu ứng Ken Burns |
| **Dựng video** | Ghép cảnh, phụ đề tự động, nhạc nền, xuất 9:16 | FFmpeg, MoviePy, Whisper (căn phụ đề) |
| **Đăng bài** | Upload và lên lịch đa nền tảng | YouTube Data API, Facebook Graph API, TikTok Content Posting API |
| **Webapp** | Dashboard quản lý ý tưởng, duyệt kịch bản, preview video, lịch đăng | xem phần Tech stack |

## Tận dụng gói Google AI Pro

- Gói **Google AI Pro** cho phép dùng Gemini, **Veo / Flow**, Whisk… **qua giao diện web/app** (có hạn mức theo ngày/tháng). Rất hợp cho giai đoạn đầu: làm tay hoặc bán tự động các cảnh video AI.
- Gói Pro **không bao gồm quyền gọi API**. Muốn tự động hoá hoàn toàn cần API key từ **Google AI Studio** hoặc **Vertex AI**:
  - Gemini (text, TTS) có free tier — đủ để làm kịch bản và giọng đọc ở giai đoạn MVP.
  - Veo / Imagen qua API được tính phí riêng theo lượng sử dụng.
- **Chiến lược đề xuất:** MVP dùng Gemini API free tier cho kịch bản + TTS; cảnh video AI tạo thủ công trên Flow bằng gói Pro rồi đưa vào viup để dựng; khi kênh có doanh thu mới chuyển sang Veo API để tự động hoá toàn bộ.

## Tech stack đề xuất (chưa chốt)

- **Backend:** Python + FastAPI — hệ sinh thái mạnh cho crawl, AI và xử lý video (FFmpeg).
- **Frontend:** Next.js / React.
- **Database:** SQLite cho bản đầu, chuyển sang PostgreSQL khi cần.
- **Job queue:** background task đơn giản → Celery / RQ khi pipeline nặng hơn.

## Roadmap

- [ ] **Phase 1** – Crawl trend + sinh kịch bản, hiển thị và chỉnh sửa trên webapp.
- [ ] **Phase 2** – TTS + dựng video từ ảnh/clip + phụ đề tự động.
- [ ] **Phase 3** – Tích hợp video AI (Veo), nhân vật nhất quán.
- [ ] **Phase 4** – Lên lịch & tự đăng đa nền tảng, thống kê hiệu quả (view, retention).

## Lưu ý về chính sách nền tảng

- **YouTube** hạn chế kiếm tiền với nội dung "mass-produced" / lặp lại / thiếu giá trị riêng — mỗi video nên có góc nhìn, biên tập hoặc giá trị gia tăng thật sự.
- **YouTube, TikTok, Facebook** yêu cầu gắn nhãn nội dung được tạo bằng AI trông giống thật.
- Tôn trọng **bản quyền** của nguồn crawl (văn bản, hình ảnh, nhạc): dùng dữ liệu làm cảm hứng/thông tin, không re-up nguyên văn.
- Vì vậy pipeline luôn có bước **duyệt thủ công** trước khi đăng.

## Trạng thái

🚧 Đang ở giai đoạn nghiên cứu và thiết kế — chưa có code.

# Đăng ký API (làm sớm — duyệt audit mất nhiều tuần)

Khi chưa qua audit, video đăng bằng API của **YouTube và TikTok bị khoá ở chế độ riêng tư**. Nộp hồ sơ ngay từ Phase 0 để tới Phase 6 là dùng được.

Nên dùng **một tài khoản Google/TikTok/Facebook riêng cho kênh** (không phải tài khoản cá nhân chính).

## 1. Gemini API (cần cho Phase 2) — 5 phút
1. Vào https://aistudio.google.com → **Get API key** → tạo key (giữ ở free tier, **không** bật billing nếu muốn chắc chắn 0đ).
2. Tạo file `.env` ở thư mục gốc repo: `GEMINI_API_KEY=...` (file này đã được gitignore).

## 2. YouTube Data API v3 (Phase 6)
1. https://console.cloud.google.com → tạo project `viup` → bật **YouTube Data API v3**.
2. **OAuth consent screen**: loại External, thêm scope `youtube.upload`, thêm email kênh làm test user.
3. Tạo **OAuth client ID** loại *Desktop app* → tải file JSON (giữ bí mật).
4. Nộp **YouTube API Services Audit** (form "YouTube API Services - Audit and Quota Extension") để video được đăng công khai. Cần mô tả: tool đăng nội dung tự sản xuất lên kênh của chính mình.

## 3. TikTok Content Posting API (Phase 6)
1. https://developers.tiktok.com → tạo app → thêm product **Content Posting API** (bật Direct Post).
2. Scope: `video.publish`, `video.upload`. Cần website/chính sách quyền riêng tư cho app (có thể dùng trang GitHub Pages đơn giản).
3. Nộp **audit**. Trong lúc chờ: chỉ đăng được riêng tư hoặc gửi vào hộp nháp.

## 4. Facebook (Reels lên Page) (Phase 6)
1. Tạo **Facebook Page** cho kênh.
2. https://developers.facebook.com → tạo app loại Business → thêm quyền `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
3. Với Page của chính bạn (bạn là admin app), chế độ development thường đủ để thử; khi chạy lâu dài nên làm App Review.

## 5. Cảnh báo lỗi qua Telegram (Phase 4, tuỳ chọn)
1. Chat với `@BotFather` → `/newbot` → lấy token.
2. Thêm vào `.env`: `TELEGRAM_BOT_TOKEN=...` và `TELEGRAM_CHAT_ID=...`.

# Đăng ký API (làm sớm — duyệt audit mất nhiều tuần)

Khi chưa qua audit, video đăng bằng API của **YouTube và TikTok có thể bị khoá ở chế độ riêng tư**. Các bước tạo app làm ngay được; riêng nộp audit cần trang pháp lý và video demo (xem mục 0).

**Trạng thái (2026-10-19):**

| Dịch vụ | Trạng thái |
|---|---|
| Gemini | ✅ Đang dùng |
| YouTube | ✅ OAuth + upload riêng tư. Video vẫn chuyển sang công khai được. Audit đang chờ. |
| TikTok | ✅ Sandbox, đẩy được vào hộp nháp. Số liệu cần bật thêm Display API (mục 3, bước 3). |
| Facebook | ⏳ Tài khoản quá mới để đăng ký Meta developer, nên đang đăng tay |
| Telegram | Tuỳ chọn |

Nên dùng **một tài khoản Google/TikTok/Facebook riêng cho kênh** (không phải tài khoản cá nhân chính).

## 0. Chuẩn bị chung cho cả 2 audit

Cả YouTube và TikTok đều đòi app có **trang web công khai** gồm *Chính sách quyền riêng tư* và *Điều khoản sử dụng*, và muốn thấy app **thực sự chạy được** (video demo hoặc tài khoản thử). Vì vậy thứ tự đúng là:

1. Tạo tài khoản riêng cho kênh: Gmail mới, kênh YouTube "Crab vibe", tài khoản TikTok.
2. ✅ Trang pháp lý đã có trên **GitHub Pages** (nguồn ở `site/`, tự deploy khi push):
   - Trang chủ: https://soetiee2207.github.io/viup/
   - Privacy Policy: https://soetiee2207.github.io/viup/privacy/
   - Terms of Service: https://soetiee2207.github.io/viup/terms/
3. Code **luồng đăng bài tối thiểu** (Phase 6a, làm sớm): đăng nhập OAuth → upload 1 video ở chế độ riêng tư. Quay màn hình lại để làm video demo.
4. Nộp audit. Trong lúc chờ (vài tuần đến vài tháng), tool vẫn chạy các phase khác bình thường.

## 1. Gemini API (cần cho Phase 2) — 5 phút
1. Vào https://aistudio.google.com → **Get API key** → tạo key (giữ ở free tier, **không** bật billing nếu muốn chắc chắn 0đ).
2. Tạo file `.env` ở thư mục gốc repo: `GEMINI_API_KEY=...` (file này đã được gitignore).

## 2. YouTube Data API v3

**A. Tạo project và OAuth (làm ngay, khoảng 20 phút)**
1. https://console.cloud.google.com → đăng nhập **tài khoản của kênh** → *New project* tên `viup`.
2. *APIs & Services → Library* → tìm **YouTube Data API v3** → *Enable*.
3. *Google Auth Platform* (hoặc *OAuth consent screen*):
   - User type: **External**. App name: `viup`. Support email: email kênh.
   - *App domain*: điền link trang chủ, privacy policy, terms (bước 0.2).
   - *Data access / Scopes*: thêm `https://www.googleapis.com/auth/youtube.upload` (và `youtube.readonly` để đọc số liệu ở Phase 7).
   - *Audience*: thêm email kênh vào **Test users**.
4. *Clients → Create client* → loại **Desktop app** → tải JSON, lưu thành `secrets/youtube_client.json` (thư mục này sẽ được gitignore, **không bao giờ commit**). Sau đó chạy `npm run yt:auth` để đăng nhập (token lưu trong `secrets/`).
5. **Lưu ý quan trọng:** khi app ở trạng thái *Testing*, refresh token **hết hạn sau 7 ngày**, nên tool tự động sẽ mất quyền đăng mỗi tuần. Khi luồng upload đã chạy ổn, bấm **Publish app** sang *In production*. Màn hình đăng nhập sẽ hiện cảnh báo "app chưa xác minh"; vì chỉ mình bạn dùng nên bấm *Advanced → Go to viup* là được.

**B. Nộp audit (sau khi có video demo)**
1. Mở form **YouTube API Services – Audit and Quota Extension**: https://support.google.com/youtube/contact/yt_api_form
2. Chuẩn bị sẵn:
   - **Project number** (số, ở trang Dashboard của Cloud Console).
   - Thông tin cá nhân hoặc doanh nghiệp, website, link Privacy Policy và Terms.
   - **Mô tả app**, viết trung thực và cụ thể, ví dụ: *"viup là công cụ nội bộ do một cá nhân vận hành, tự sản xuất video hoạt hình giáo dục (mascot tự thiết kế) và đăng lên DUY NHẤT kênh YouTube của chính chủ app. Không có người dùng bên ngoài. Endpoint dùng: videos.insert (đăng video tự sản xuất), videos.list (đọc số liệu kênh mình). Không lưu dữ liệu của người khác."*
   - **Video demo hoặc ảnh chụp:** màn hình OAuth đồng ý quyền → tool upload → video xuất hiện trên kênh.
   - Lượng quota cần: ghi đúng nhu cầu, ví dụ 2–3 video/ngày.
3. Trang web và app phải tuân thủ **YouTube Developer Policies**:
   - Terms của bạn phải có câu "Khi sử dụng, người dùng đồng ý với YouTube Terms of Service" kèm link.
   - Privacy Policy phải nói rõ app dùng **YouTube API Services**, kèm link Google Privacy Policy, và hướng dẫn cách **thu hồi quyền** (https://security.google.com/settings/security/permissions).
4. Sau khi nộp, đội YouTube có thể email hỏi thêm hoặc xin tài khoản thử. Trả lời đúng hạn. Thời gian chờ không cố định, từ vài tuần đến vài tháng. Nếu bị từ chối thì có form Appeal.

## 3. TikTok Content Posting API

**Lưu ý trước:** guideline của TikTok yêu cầu app đăng bài phải có **giao diện để chủ tài khoản tự chọn** quyền riêng tư, tiêu đề, bật/tắt bình luận (không chọn sẵn), có công tắc công bố nội dung thương mại, và **xác nhận đồng ý trước mỗi lần đăng**. Nghĩa là TikTok **không muốn đăng hoàn toàn tự động**, nên audit cho Direct Post khó qua với tool tự động 100%.

→ **Phương án khuyên dùng:** dùng chế độ **Upload (gửi vào hộp nháp)**. Tool tự đẩy video kèm caption vào mục *Hộp thư/Bản nháp* trong app TikTok, bạn chỉ cần mở app và **bấm Đăng**, khoảng 10 giây mỗi video. Đây là chỗ duy nhất trong pipeline cần một chạm của người.

**Các bước**
1. https://developers.tiktok.com → đăng nhập → *Manage apps → Connect an app*. Loại: cá nhân/nhà phát triển.
2. Điền app: tên `viup`, icon (dùng ảnh chú cua), mô tả, category, link **Terms** và **Privacy Policy** (bước 0.2).
3. *Add products*: **Login Kit**, **Content Posting API** và **Display API** (Display API dùng để lấy lượt xem cho tab Thống kê). Bật *Direct Post* chỉ khi muốn thử audit.
4. Scopes: `user.info.basic`, `video.upload` (nháp), `video.list` (số liệu). Thêm `video.publish` nếu thử Direct Post. Client key/secret lưu vào file trong `secrets/` (tự điền, không dán vào chat), rồi chạy `npm run tt:auth`. **Mỗi lần thêm scope phải chạy lại `npm run tt:auth`.**
5. **Verify URL properties**: xác minh domain hoặc URL prefix của trang GitHub Pages (TikTok cho tải một file chữ ký lên trang).
6. Thêm tài khoản TikTok của kênh vào *Sandbox / Target users* để thử khi chưa duyệt.
7. **Submit for review**: giải thích từng product và scope dùng để làm gì, và đính kèm **video demo** quay toàn bộ luồng: đăng nhập TikTok → tool gửi video → video xuất hiện trong hộp nháp hoặc được đăng.
8. Theo dõi email. TikTok thường phản hồi vài vòng. Mỗi lần thay đổi app sau khi được duyệt đều phải nộp duyệt lại.

## 4. Facebook (Reels lên Page) (Phase 6) — chưa làm
1. ✅ Đã tạo **Facebook Page** cho kênh (2026-10-17). Đăng ký Meta developer bị chặn vì tài khoản quá mới, nên thử lại sau 1–2 tuần.
2. https://developers.facebook.com → tạo app loại Business → thêm quyền `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
3. Với Page của chính bạn (bạn là admin app), chế độ development thường đủ để thử; khi chạy lâu dài nên làm App Review.

## 5. Cảnh báo lỗi qua Telegram (Phase 4, tuỳ chọn)
1. Chat với `@BotFather` → `/newbot` → lấy token.  
2. Thêm vào `.env`: `TELEGRAM_BOT_TOKEN=...` và `TELEGRAM_CHAT_ID=...`.

# viup

> Tool **tự động 100%** làm video Short hoạt hình 2D tiếng Việt cho kênh **Crab vibe** (mascot: chú cua Cự Giải): tự chọn chủ đề → viết kịch bản → tự kiểm duyệt → giọng đọc → dựng video → đẩy nháp lên TikTok + YouTube → thống kê hiệu quả.

## Giới thiệu

Máy tự chạy mỗi ngày (7:00 và 15:30), làm **3 video/ngày**, dọc **9:16, dài khoảng 30–60 giây**. Không có bước duyệt tay; mọi nội dung AI đều phải qua QA tự động. Người dùng chỉ việc mở app TikTok hoặc YouTube Studio và bấm **Đăng** vào giờ mình muốn.

Có 2 định dạng nội dung (tỉ lệ chỉnh được trong app, mặc định 60/40):

| Định dạng | Kiểu video | Nguồn |
|---|---|---|
| `fun-fact`: sự thật thú vị | **Kể chuyện**: Cua nói chuyện với một nhân vật khách được nhân hoá (vd hạt mưa, con mèo), 2 giọng. Chủ đề là bí ẩn đời thường. Video phải nói rõ tên, ở đâu và một con số. | Wikipedia (vi + en) |
| `zodiac`: cung hoàng đạo | Cua kể một mình, có gọi tên cung và ngày sinh | LLM, không cần nguồn |

## Pipeline

```
Kho ý tưởng (Gemini brainstorm + chấm + chống trùng)
  → Nguồn Wikipedia → Viết kịch bản (Gemini, JSON) → Kiểm tra bằng code → QA bằng LLM (viết lại ≤ 2 lần)
  → Giọng đọc edge-tts (mốc từng từ) → Dựng video bằng code (Remotion) → videos/<ngày>/N-slug.mp4 + .txt caption
  → Nháp TikTok + YouTube riêng tư → Thống kê lượt xem / giờ đăng
```

## Chi phí ≈ 0đ

| Phần | Dùng gì |
|---|---|
| Kịch bản, ý tưởng, QA, hashtag | Gemini API free tier (AI Studio) |
| Giọng đọc | edge-tts (giọng Microsoft, miễn phí) |
| Hoạt hình | Code: Remotion + icon Fluent Emoji (MIT), nhân vật cua vẽ 1 lần bằng Gemini app |
| Nhạc nền, SFX | Tự tổng hợp bằng code nên không dính bản quyền |
| Chạy hằng ngày | systemd timer trên máy nhà |

Gói Google AI Pro **không có API**, nên chỉ dùng tay một lần để vẽ nhân vật ([docs/GEMINI_PROMPTS.md](docs/GEMINI_PROMPTS.md)).

## Bắt đầu

Cần Node.js ≥ 23, [uv](https://docs.astral.sh/uv/) và ffmpeg. Thêm `GEMINI_API_KEY=...` vào file `.env` (xem [docs/SETUP_APIS.md](docs/SETUP_APIS.md)).

```bash
npm install
npm run make -- "vì sao mèo thích hộp giấy"   # làm thử 1 video
npm run daily:install                          # hẹn giờ chạy hằng ngày 7:00 + 15:30
npm run app:install                            # cài app desktop "viup" (http://localhost:3210)
```

Các lệnh còn lại xem trong [CLAUDE.md](CLAUDE.md).

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `packages/brain` | Chủ đề → kịch bản (VideoSpec): ý tưởng, nguồn, viết, QA, caption ([README](packages/brain/README.md)) |
| `packages/video` | Scene engine Remotion: VideoSpec → MP4 1080×1920 ([README](packages/video/README.md)) |
| `packages/publish` | YouTube / TikTok: OAuth, upload nháp, lấy số liệu |
| `packages/core` | SQLite + Drizzle, hàng đợi job, đọc thư mục `videos/` |
| `worker` | `daily.ts` chạy hằng ngày (làm video → đẩy nháp → số liệu) |
| `apps/web` | App viup: video theo ngày, Thống kê, Ý tưởng, Cài đặt, Nhật ký |
| `tools/` | TTS (edge-tts), nhạc/SFX, xoá nền ảnh |
| `site/` | Trang chủ, Privacy, Terms trên GitHub Pages (phục vụ audit) |

## Trạng thái (2026-10-19)

- [x] Phase 0: monorepo, DB, hàng đợi job.
- [x] Phase 1: scene engine (cắt cảnh nhanh, đồ vật biết nói, máy quay, SFX, phụ đề từng từ).
- [x] Phase 2: brain (viết + QA tự động).
- [x] Phase 3: kho ý tưởng, `make --auto`.
- [x] Phase 4: chạy hằng ngày bằng systemd timer.
- [x] Phase 5: app desktop viup.
- [~] Phase 6: tự đẩy **nháp** TikTok + YouTube riêng tư; người dùng bấm đăng. Facebook đăng tay (tài khoản quá mới để đăng ký Meta developer).
- [~] Phase 7: trang Thống kê (lượt xem theo giờ đăng và theo định dạng). Số liệu TikTok cần bật Display API. Chưa tự học lại vào prompt.
- [x] 2026-10-19: fun-fact chuyển sang kiểu **kể chuyện có nhân vật khách**.

Chi tiết: [docs/PLAN.md](docs/PLAN.md).

## Lưu ý chính sách nền tảng

- **YouTube** hạn chế kiếm tiền với nội dung "sản xuất hàng loạt". Kênh giảm rủi ro bằng: mascot riêng, kịch bản viết lại (QA chống chép nguyên văn), không đăng quá dày.
- **Gắn nhãn nội dung AI** khi đăng (file caption có nhắc).
- **Bản quyền:** chỉ dùng nguồn làm thông tin; nhạc và SFX tự tổng hợp; icon có license MIT.

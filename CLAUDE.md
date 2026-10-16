# viup

Tool **tự động 100%** làm video Short hoạt hình 2D (mascot: chú cua Cự Giải) cho YouTube Shorts / FB Reels / TikTok.
Kế hoạch & phase hiện tại: **docs/PLAN.md** — đọc trước khi làm, chỉ làm phase được giao. Phase 1–5 xong (Phase 4 = systemd timer chạy `npm run daily` 7:00 + 15:30; Phase 5 = app desktop viup). Facebook/YouTube công khai đang đăng tay (tài khoản FB quá mới để đăng ký Meta developer; YouTube chờ audit). Trả lời & viết tài liệu bằng **tiếng Việt**.

## Cấu trúc
- `packages/core` — SQLite (libsql) + Drizzle: `schema.ts`, `db.ts` (createDb/migrateDb), `queue.ts` (hàng đợi job trong DB, retry backoff).
- `worker` — vòng lặp lấy job → `src/handlers.ts` (mỗi bước pipeline = 1 job type); `src/daily.ts` + `src/install-timer.ts` = chạy hằng ngày bằng systemd timer.
- `apps/web` — Next.js, app quản lý "viup" (port 3210): `app/page.tsx` (video theo ngày), `ideas/`, `settings/`, `logs/`, `actions.ts` (server actions), `lib/viup.ts` (đọc videos/, log, timer); `scripts/install-app.ts` cài thành app desktop. Next 16: đọc `node_modules/next/dist/docs/` trước khi sửa.
- `packages/video` — Remotion scene engine: `spec.json` (VideoSpec) → `src/timeline.ts` (chia beat, chọn mặc định) → `Short.tsx`/`Scene.tsx` (cảnh, máy quay, chuyển cảnh), `Prop.tsx` (đồ vật biết nói), `Background.tsx`, `Character.tsx` (cua); `scripts/render.ts` chạy cả chuỗi; render 1080×1920.
- `packages/brain` — chủ đề → VideoSpec: `source.ts` (Wikipedia), `write.ts` (prompt viết), `validate.ts` (kiểm tra/tự sửa bằng code), `qa.ts` (QA bằng LLM), `pipeline.ts` (vòng viết lại + lưu DB), `gemini.ts` (gọi API + đếm hạn mức bảng `api_calls`), `formats.ts` (fun-fact, zodiac), `ideas.ts` (brainstorm + chấm + chống trùng ý tưởng); CLI `make.ts`.
- `packages/publish` — YouTube OAuth + upload (`npm run yt:auth`, `npm run yt:upload`); token ở `secrets/`.
- `tools/tts/make_voice.py` — edge-tts (giọng nam NamMinh, +16%, −14 LUFS) → voice.wav + manifest.json (mốc từng từ); `tools/music/make_loop.py` / `make_sfx.py` — nhạc nền / SFX tự tổng hợp; `tools/cut_bg.py` — xoá nền ảnh Gemini.
- `site/` — GitHub Pages (trang chủ, privacy, terms cho audit); deploy bằng Actions, Pages source phải là "GitHub Actions".
- `docs/` — PLAN, GEMINI_PROMPTS (prompt vẽ nhân vật), SETUP_APIS.

## Lệnh
```bash
npm install
npm run dev            # web (http://localhost:3210) + worker
npm run typecheck      # tất cả workspace
npm run db:generate    # sau khi sửa packages/core/src/schema.ts
npm run render -w @viup/video -- spec.json   # xem nhanh: npm run stills -w @viup/video
npm run make -- "chủ đề" [--format zodiac] [--date YYYY-MM-DD] [--no-render] [--stills]   # chủ đề -> videos/<ngày đăng>/N-slug.mp4 + .txt caption; --usage xem hạn mức Gemini
npm run make -- --auto [--days N]   # tự chọn chủ đề (kho ý tưởng: --ideas [--discover]) và làm đủ video/ngày
npm run app:install    # build giao diện + cài app desktop viup (chạy lại sau khi sửa apps/web)
npm run daily          # làm video hôm nay + mai, log data/logs/; daily:install / daily:uninstall = hẹn giờ systemd
npm run tt:auth && npm run tt:upload [file.mp4]   # TikTok: đẩy video vào nháp (Sandbox)
```

## Quy ước
- TypeScript chạy **trực tiếp bằng Node** (type stripping): import nội bộ ghi đuôi `.ts`, không dùng enum/namespace/parameter properties.
- Kiểm tra hình bằng `npm run stills -w @viup/video` (1 ảnh/cảnh + `out/stills/sheet.png`) rồi xem ảnh, đừng render cả video mỗi lần sửa.
- Chi phí ~0: hoạt hình bằng code, text AI = Gemini API free tier, TTS = edge-tts. Không thêm dịch vụ trả phí nếu chưa hỏi.
- Không có người duyệt → mọi nội dung AI phải qua bước QA tự động (Phase 2).
- DB ở `data/viup.db` (gitignored); đổi bằng env `VIUP_DB_PATH`.

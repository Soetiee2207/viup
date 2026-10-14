# viup

Tool **tự động 100%** làm video Short hoạt hình 2D (mascot: chú cua Cự Giải) cho YouTube Shorts / FB Reels / TikTok.
Kế hoạch & phase hiện tại: **docs/PLAN.md** — đọc trước khi làm, chỉ làm phase được giao. Việc tiếp theo: **Phase 1 scene engine** (mục ghi "VIỆC TIẾP THEO"). Trả lời & viết tài liệu bằng **tiếng Việt**.

## Cấu trúc
- `packages/core` — SQLite (libsql) + Drizzle: `schema.ts`, `db.ts` (createDb/migrateDb), `queue.ts` (hàng đợi job trong DB, retry backoff).
- `worker` — vòng lặp lấy job → `src/handlers.ts` (mỗi bước pipeline = 1 job type).
- `apps/web` — Next.js dashboard giám sát (port 3210), đọc DB qua `lib/db.ts#getDb`.
- `packages/video` — Remotion: cua dẫn chương trình (`Character.tsx`), bảng icon (`Stage.tsx`), phụ đề, nhạc nền + ducking (`Short.tsx`), icon Fluent Emoji (`scripts/icons.ts`); render 1080×1920.
- `packages/publish` — YouTube OAuth + upload (`npm run yt:auth`, `npm run yt:upload`); token ở `secrets/`.
- `tools/tts/make_voice.py` — edge-tts (giọng nam NamMinh, +16%, −14 LUFS) → voice.wav + manifest.json; `tools/music/make_loop.py` — nhạc nền tự tổng hợp; `tools/cut_bg.py` — xoá nền ảnh Gemini.
- `site/` — GitHub Pages (trang chủ, privacy, terms cho audit); deploy bằng Actions, Pages source phải là "GitHub Actions".
- `docs/` — PLAN, GEMINI_PROMPTS (prompt vẽ nhân vật), SETUP_APIS.

## Lệnh
```bash
npm install
npm run dev            # web (http://localhost:3210) + worker
npm run typecheck      # tất cả workspace
npm run db:generate    # sau khi sửa packages/core/src/schema.ts
npm run voice -w @viup/video && npm run render -w @viup/video
```

## Quy ước
- TypeScript chạy **trực tiếp bằng Node** (type stripping): import nội bộ ghi đuôi `.ts`, không dùng enum/namespace/parameter properties.
- Kiểm tra hình bằng `npx remotion still Short <file>.png --frame=N` (trong packages/video) rồi xem ảnh, đừng render cả video mỗi lần sửa.
- Chi phí ~0: hoạt hình bằng code, text AI = Gemini API free tier, TTS = edge-tts. Không thêm dịch vụ trả phí nếu chưa hỏi.
- Không có người duyệt → mọi nội dung AI phải qua bước QA tự động (Phase 2).
- DB ở `data/viup.db` (gitignored); đổi bằng env `VIUP_DB_PATH`.

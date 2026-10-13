# viup

Tool **tự động 100%** làm video Short hoạt hình 2D (mascot: chú cua Cự Giải) cho YouTube Shorts / FB Reels / TikTok.
Kế hoạch & phase hiện tại: **docs/PLAN.md** — đọc trước khi làm, chỉ làm phase được giao. Trả lời & viết tài liệu bằng **tiếng Việt**.

## Cấu trúc
- `packages/core` — SQLite (libsql) + Drizzle: `schema.ts`, `db.ts` (createDb/migrateDb), `queue.ts` (hàng đợi job trong DB, retry backoff).
- `worker` — vòng lặp lấy job → `src/handlers.ts` (mỗi bước pipeline = 1 job type).
- `apps/web` — Next.js dashboard giám sát (port 3210), đọc DB qua `lib/db.ts#getDb`.
- `packages/video` — Remotion: nhân vật 2D cắt ghép (`Character.tsx`), phụ đề, render 1080×1920.
- `tools/tts/make_voice.py` — edge-tts → voice.wav + manifest.json (`uv run`); `tools/cut_bg.py` — xoá nền ảnh Gemini.
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
- Chi phí ~0: hoạt hình bằng code, text AI = Gemini API free tier, TTS = edge-tts. Không thêm dịch vụ trả phí nếu chưa hỏi.
- Không có người duyệt → mọi nội dung AI phải qua bước QA tự động (Phase 2).
- DB ở `data/viup.db` (gitignored); đổi bằng env `VIUP_DB_PATH`.

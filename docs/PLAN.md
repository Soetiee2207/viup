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
- Prompt vẽ nhân vật nằm trong [`docs/GEMINI_PROMPTS.md`](GEMINI_PROMPTS.md). Phase 1 thêm hỗ trợ lớp càng riêng.
- ✅ (2026-10-19) Video fun-fact có **nhân vật khách** được nhân hoá (icon + giọng riêng) nói chuyện với cua. Xem Phase 2b.

## 1c. Chủ đề (chốt 2026-10-13)

Một kênh, mascot cua, xen kẽ 2 **định dạng nội dung** (format), tỉ lệ cấu hình được:

| Format | Tỉ lệ ban đầu | Ví dụ | Nguồn |
|---|---|---|---|
| `fun-fact` — sự thật thú vị, kể chuyện | 60% | "Mưa có mùi gì?", "Mèo có mấy ngón chân?" | Wikipedia (vi + en) |
| `zodiac` — cung hoàng đạo & tâm lý vui | 40% | "3 cung dễ ghen nhất", "Cự Giải khi giận sẽ…" | LLM sinh ý tưởng theo bộ khung chủ đề, không cần crawl |

- Tránh: tin nóng, sức khoẻ, tài chính, chính trị, drama người thật (AI viết sai khi không có người duyệt là rủi ro lớn).
- Format là plugin: thêm format mới (vd `quiz`) không phải sửa pipeline. Phase 7 tự điều chỉnh tỉ lệ theo hiệu quả.

---

## 2. Kiến trúc

Dùng TypeScript cho hầu hết hệ thống (chung với Remotion). Python chỉ giữ cho TTS.

```
viup/
├─ apps/web/          Next.js — app desktop "viup": video theo ngày, thống kê, ý tưởng, cài đặt, nhật ký
├─ worker/            daily.ts (systemd timer 7:00 + 15:30) + hàng đợi job cho nút bấm trên web
├─ packages/
│  ├─ core/           schema DB (SQLite + Drizzle), hàng đợi job, đọc videos/ (caption, uploads, stats)
│  ├─ brain/          Gemini: ý tưởng, nguồn Wikipedia, viết kịch bản, QA, caption + hashtag
│  ├─ video/          Remotion scene engine: VideoSpec JSON -> MP4
│  └─ publish/        YouTube / TikTok: OAuth, đẩy nháp, lấy số liệu
├─ tools/             tts/make_voice.py (edge-tts), music/ (nhạc nền, SFX), cut_bg.py
├─ site/              GitHub Pages: trang chủ, privacy, terms
├─ secrets/           token OAuth (gitignored)
├─ data/              viup.db, logs/, publish.json (bật/tắt đẩy nháp), stats.json (gitignored)
└─ videos/<ngày>/     N-slug.mp4 + N-slug.txt (caption), uploads.json, posted.json
```

- **Hàng đợi job:** bảng `jobs` trong SQLite, có `status`, `attempts`, `run_after`. Không cần Redis. Mỗi bước pipeline là một job, lỗi thì tự thử lại có backoff.
- **Thứ tự dữ liệu:** `Channel` (ngách, giọng, nhân vật, lịch đăng) → `Idea` → `Script` → `Video` → `Post` → `Metrics`.
- **VideoSpec (JSON):** hợp đồng giữa phần "não" (brain) và phần dựng video. LLM sinh ra spec, Remotion render spec. Tách như vậy để test riêng từng phía. Định dạng hiện tại xem `packages/video/README.md` (hook, music, guest, lines → speaker/emotion/beats). Tiêu đề và caption nằm ở file `.txt` cạnh MP4, không nằm trong spec.

---

## 3. Lộ trình (mỗi phase ≈ 1–2 phiên code)

### Phase 0 — Khung dự án ✅ (2026-10-13)
- Chuyển sang monorepo (npm workspaces), đưa `prototype/` vào `packages/video`.
- SQLite (libsql) + Drizzle, schema các bảng ở trên, hàng đợi job trong DB. Viết `CLAUDE.md` mô tả kiến trúc và lệnh chạy.
- **Đăng ký ngay** API YouTube, TikTok, Facebook và gửi audit, vì phải chờ duyệt lâu (xem mục 4).
- ✅ Xong khi: `npm run dev` chạy được web và worker rỗng; DB được tạo.

### Phase 6a — Upload tối thiểu (làm sớm, phục vụ audit) — ✅ YouTube (2026-10-14), TikTok Sandbox (2026-10-16)
- Trang Privacy Policy + Terms trên GitHub Pages.
- CLI: OAuth YouTube → upload 1 video riêng tư; TikTok: gửi video vào hộp nháp (Upload API).
- Quay video demo để nộp audit (xem docs/SETUP_APIS.md).
- ✅ Xong khi: upload thành công trên cả 2 nền tảng ở chế độ riêng tư/nháp.

### Phase 1 — Video engine v2: "scene engine" (từ VideoSpec ra MP4) — ✅ (2026-10-15)

**Đã có:** bố cục dẫn chương trình (bảng icon ở trên, phụ đề giữa, cua ở dưới), icon Fluent Emoji Flat (`scripts/icons.ts`), nhạc nền tự tổng hợp + ducking (`tools/music/make_loop.py`), giọng nam NamMinh +16%, chuẩn hoá −14 LUFS.

**Vấn đề (2026-10-15):** video còn tĩnh, "chán". Mẫu tham khảo: kênh *Bé Cơm Nắm* (youtube.com/shorts/pMFI5z-52N4). Ở đó mỗi cảnh là tranh kín màn hình, cắt cảnh 1–2 giây, **đồ vật có mắt và miệng biết biểu cảm**, nền tia sáng hoặc bokeh, máy quay zoom và lắc, có nhân vật phản ứng, tiêu đề hook to ở đầu.

**Mục tiêu:** đạt độ sinh động tương đương **chỉ bằng code (0đ)**. Thay hẳn `Stage.tsx` (bảng trắng) bằng scene engine:

1. **Cảnh kín màn hình, cắt nhanh:** mỗi câu chia 2–3 *beat* khoảng 1–2 giây (chia theo dấu phẩy hoặc nhóm từ, căn theo WordBoundary). Chuyển cảnh: lướt ngang, zoom-punch, flash trắng, xoay nhẹ.
2. **Đồ vật biết nói (anthropomorphic props):** gắn mắt và miệng lên icon, tái sử dụng `Eye` và `Mouth` trong `Character.tsx`. Cần bảng toạ độ mặt cho từng icon thường dùng (mặc định: giữa icon, hơi cao). Đồ vật chính của cảnh nhép miệng khi là "người nói", chớp mắt, đổi biểu cảm theo `emotion`.
3. **Nền động theo cảm xúc:** `burst` (tia sáng xoay, khi ngạc nhiên hoặc vui), `speedlines` (nhấn mạnh), `bokeh` (bình thường), `gloom` (buồn, tối màu, mưa nhẹ). Màu theo bảng màu của từng cảm xúc.
4. **Máy quay:** zoom chậm liên tục (Ken Burns), zoom-punch đầu beat, lắc (shake) khi `ngacnhien` hoặc có nhấn mạnh, và cận mặt cua khi phản ứng.
5. **Cua tham gia trong cảnh, không đứng cố định:** các kiểu bố cục `crab-presents` (cua bên cạnh đồ vật), `crab-closeup` (cận mặt cua phản ứng "Hả?!", cỡ to), `object-hero` (đồ vật chiếm màn hình, cua nhỏ ở góc), `versus` (2 đồ vật đối đầu), `count` (đếm số lượng, số chạy lên).
6. **Hiệu ứng âm thanh tự tổng hợp** (`tools/music/make_sfx.py`): whoosh (chuyển cảnh), pop (icon xuất hiện), boing (nhảy), ding (nhãn), record-scratch (bất ngờ). Đặt theo sự kiện trong timeline, cũng được duck nhẹ.
7. **Hook 2 giây đầu:** tiêu đề to kiểu "Bạn có biết…" + câu hỏi, đập vào màn hình, cua cận mặt.
8. **Phụ đề khớp từng từ** bằng WordBoundary của edge-tts (thay cho ước lượng theo số ký tự). Đưa mốc thời gian từng từ vào manifest.

**Định dạng kịch bản mới (VideoSpec JSON):** thay `script.txt` bằng `spec.json`, Phase 2 sẽ do AI sinh ra.
```jsonc
{
  "hook": "Bạn có biết?",
  "music": "music/sunny-reef.mp3",
  "lines": [
    {
      "text": "Bạch tuộc có tới ba trái tim!",
      "emotion": "ngacnhien",
      "beats": [
        {"layout": "crab-closeup"},
        {"layout": "count", "props": [{"icon": "anatomical-heart", "count": 3, "face": true}], "label": "3 TRÁI TIM", "bg": "burst"}
      ]
    }
  ]
}
```
- Engine tự chọn mặc định hợp lý khi beat thiếu trường (layout, bg, sfx), nên AI chỉ cần điền tối thiểu.
- Giữ tương thích: công cụ chuyển `script.txt` cũ sang spec.

**✅ Xong khi:** `npm run render -w @viup/video -- spec.json` ra MP4 có cắt cảnh 1–2 giây, đồ vật có mặt biết nhép miệng, nền động, máy quay động, SFX, hook đầu video; có lệnh render vài khung hình (still) để kiểm tra nhanh. Người dùng xem và thấy "sinh động" ngang mẫu tham khảo.

**Kết quả (2026-10-15):** làm đủ 8 mục trên (xem packages/video/README.md). Beat có thêm trường `from` (cụm từ mở đầu beat) để chỉ định chỗ cắt. `versus` chỉ dùng khi spec ghi rõ. Spec mẫu: `packages/video/spec.json`. Render 22 giây mất ~40 giây; `npm run stills` ~30 giây.
**Chưa làm:** lớp càng cua riêng (chưa có ảnh); toạ độ mặt mới chỉnh cho ~20 icon.

**Để sau / Mức 2 (tốn phí, chỉ làm khi Mức 1 chưa đủ):** dùng Gemini API vẽ tranh cảnh riêng cho từng beat (phải tra giá ảnh API trước). Hội thoại 2 nhân vật đã làm bằng icon (Phase 2b).

### Phase 2 — Brain (từ chủ đề ra VideoSpec) — ✅ (2026-10-16)
- Gemini API: `writeScript(idea, channel)` trả về VideoSpec, ép output theo JSON schema.
- **QA tự động** thay cho người duyệt. Một lượt LLM thứ hai kiểm tra:
  - nội dung có khớp với nguồn crawl không (chống bịa), độ dài;
  - chủ đề cấm hoặc nhạy cảm, bản quyền (không chép nguyên văn);
  - hook có đủ mạnh không.
  - Không đạt thì viết lại tối đa 2 lần, vẫn không đạt thì bỏ ý tưởng.
- Bộ đếm hạn mức API và tự giãn tốc độ khi gần chạm free tier.
- ✅ Xong khi: `npm run make -- "chủ đề"` ra MP4 hoàn chỉnh, không chạm tay.

**Kết quả (2026-10-15):** xem packages/brain/README.md. Chủ đề → model lite đoán tên bài Wikipedia → lấy bài vi + en (giữ đoạn liên quan) → viết → kiểm tra bằng code (tự sửa icon, beat) → QA 6 tiêu chí (thêm `topic`: đúng chủ đề) → viết lại tối đa 2 lần → lưu DB (ideas, scripts, videos) → render. Nguồn không có thông tin thì bỏ ngay sau 1 lượt. ~1 phút/video.
**Lưu ý hạn mức:** free tier của `gemini-3.8-flash` chỉ **20 lượt/ngày** (reset 0h giờ Thái Bình Dương). Mỗi video tốn 3–7 lượt, hết thì tự dùng `gemini-flash-lite-latest` (kịch bản kém hơn: hay viết ngắn, ít chia beat; code tự bù). Bảng `api_calls` lưu từng lượt gọi.

### Phase 2b — Fun-fact kiểu kể chuyện — ✅ (2026-10-19)
**Vấn đề:** người xem không biết đang nói về cái gì (vd video cọ biết đi, hoa xác chết không nói tên, không nói ở đâu), và câu chuyện chưa cuốn hút. Mẫu tham khảo: kênh *Siêu Nhân Heo Ú* (bí ẩn đời thường, đồ vật nhân hoá nói chuyện, 55s–1m30).

**Kết quả:** người dùng duyệt 2 video mẫu (sữa heo, hành tây), chốt "từ sau làm theo hướng này".
- **Fun-fact:**
  - Có **nhân vật khách** (`guest`: icon + tên + giọng `nu`/`tram`/`be`) nói ít nhất 1/3 số câu.
  - Mạch: hook → khách tự giới thiệu (tên + ở đâu) → hỏi/giải thích → bất ngờ → chốt → kêu gọi theo dõi.
  - Dài 9–14 câu, 120–175 chữ (~45–60 giây). Phải đổi đơn vị sang hệ mét.
- **Zodiac:** giữ một mình cua kể, 5–8 câu, phải gọi tên cung.
- **QA:** thêm tiêu chí `essentials` (đủ tên, ở đâu, một con số). Tên khoa học không đọc, đưa vào mô tả YouTube (`📌`).
- **Engine:**
  - Layout `dialogue`, `speaker` cho từng câu, giọng khách riêng.
  - Phụ đề trong ô màu theo người nói, bảng tên khách.
- **Ý tưởng:** ưu tiên bí ẩn đời thường (đồ ăn, cơ thể, đồ trong nhà, con vật quen thuộc).

**Để sau:** bối cảnh/nền phong phú hơn, nhiều kiểu cảnh hội thoại hơn. Tranh vẽ tay từng cảnh thì không làm được ở mức 0đ.

### Phase 3 — Sources (tìm và chọn ý tưởng) — ✅ (2026-10-16)
- Các crawler như trên; chuẩn hoá về `Idea {title, summary, sourceUrl, sourceText}`.
- Chống trùng: so sánh với ý tưởng đã làm (hash + LLM so độ giống).
- LLM chấm điểm theo ngách của kênh, khả năng viral, độ an toàn; chọn top N mỗi ngày.
- ✅ Xong khi: mỗi ngày tự sinh danh sách ý tưởng đã chấm điểm.

**Kết quả (2026-10-16):** `packages/brain/src/ideas.ts`. Không dùng crawler: Reddit chặn (403), "Did you know" của Wikipedia toàn chủ đề hẹp/chính trị. Thay bằng model lite brainstorm 12 ý tưởng/format theo nhóm chủ đề xoay vòng mỗi ngày, tự chấm (hợp kênh, viral, an toàn, có nguồn) → code lọc (an toàn < 5 hoặc khó kiểm chứng thì bỏ) và chống trùng (fingerprint + độ giống tập từ ≥ 0,7 so với 300 ý tưởng gần nhất). Fun-fact vẫn kiểm tra nguồn Wikipedia ở bước viết; không có nguồn thì lấy ý tưởng kế tiếp (tối đa 4 lần/ô). `npm run make -- --auto [--days N]` chia video theo tỉ lệ format của kênh, làm đủ cho ngày còn thiếu; `--ideas [--discover]` xem/sinh kho ý tưởng.

### Phase 4 — Worker tự động end-to-end — ✅ (2026-10-17)
- Cron theo `Channel.schedule` → chuỗi job discover → select → script → QA → TTS → render → (upload).
- Tự thử lại, log, cảnh báo khi lỗi liên tục (gửi tin Telegram, miễn phí).
- Tự dọn file render cũ.
- ✅ Xong khi: chạy 3 ngày liền tự ra video mỗi ngày, không can thiệp.

**Kết quả (2026-10-17):** dùng systemd timer (user) thay vì worker chạy suốt — nhẹ, `Persistent=true` chạy bù khi máy bật lại. `worker/src/daily.ts` (`npm run daily`): `make --auto --days 2 --ahead 1` (đủ video hôm nay + mai, không làm dồn xa hơn), log `data/logs/<ngày>.log`, báo bằng notify-send (+ Telegram nếu có `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`), khoá chống chạy chồng, xoá `videos/<ngày>` cũ hơn 14 ngày (`VIUP_KEEP_DAYS`). `npm run daily:install` cài timer 7:00 và 15:30 (chạy bù sau khi hạn mức Gemini reset); `daily:uninstall` gỡ. Hàng đợi `jobs` + worker vẫn giữ cho Phase 5 (bấm nút trên web). Từ 2026-10-18 mỗi lần chạy còn đẩy nháp video hôm nay và cập nhật số liệu (Phase 6, 7):
`make --auto --days 2 --ahead 1` → `publish drafts <hôm nay>` → `publish stats`.

### Phase 5 — Webapp dashboard — ✅ (2026-10-17)
- Quản lý kênh: ngách, giọng, nhân vật, lịch, số video/ngày, nút tạm dừng khẩn cấp.
- Trạng thái pipeline, danh sách video kèm player xem lại, log lỗi, mức dùng API.
- ✅ Xong khi: mọi cấu hình đều chỉnh được trên web, không phải sửa file.

**Kết quả (2026-10-17):** app desktop "viup" (`npm run app:install`: build Next, service systemd `viup-web` ở 127.0.0.1:3210, `~/.local/bin/viup` mở bằng `omarchy-launch-webapp`, file .desktop + icon). Tab Video (theo ngày: xem video, copy caption, đánh dấu đã đăng từng nền tảng → `videos/<ngày>/posted.json`, xoá video không ưng), Ý tưởng (thêm chủ đề tay — điểm 99 làm trước, bỏ ý tưởng, nghĩ thêm), Cài đặt (số video/ngày, tỉ lệ format, tạm dừng hẹn giờ), Nhật ký; nút "Làm video ngay". Sửa code giao diện xong phải chạy lại `npm run app:install`. Bổ sung 2026-10-18: badge trạng thái nháp từng video, nút "Đẩy nháp ngay", công tắc đẩy nháp TikTok/YouTube trong Cài đặt, tab **Thống kê**.

### Phase 6 — Publish
- YouTube Data API (`videos.insert`), Facebook Graph API (Reels lên Page), TikTok Content Posting API.
- TikTok mặc định dùng chế độ **gửi vào hộp nháp** (một chạm bấm Đăng), vì guideline TikTok yêu cầu người dùng tự xác nhận khi Direct Post.
- Bật cờ **"nội dung tạo bằng AI"** mà các API hỗ trợ; đăng đúng giờ vàng theo lịch.
- ✅ Xong khi: video tự đăng công khai trên ít nhất 1 nền tảng.

**Kết quả (2026-10-18), bán tự động:** `packages/publish/src/drafts.ts` (`npm run drafts`).
- Mỗi ngày tool tự đẩy 3 video hôm nay:
  - vào **hộp nháp TikTok** (Sandbox, đẩy được khoảng 5 nháp/24h nên chỉ đẩy video hôm nay);
  - lên **YouTube ở chế độ riêng tư**.
- Tiêu đề, caption và hashtag lấy từ file `.txt` (`captions.ts`).
- Người dùng tự bấm đăng vào giờ muốn. Video YouTube upload qua API **không bị khoá**: người dùng đã chuyển sang công khai được.
- Kết quả từng video ghi ở `videos/<ngày>/uploads.json`. Lỗi thì lần chạy sau thử lại; YouTube trả 409 thì tự thử lại tối đa 3 lần.
- **Facebook** đăng tay, vì tài khoản quá mới để đăng ký Meta developer (thử lại sau 1–2 tuần kể từ 2026-10-17).
- Chưa làm: tự đăng công khai theo giờ.

### Phase 7 — Vòng phản hồi
- Mỗi ngày kéo số liệu view, retention, like → lưu vào `Metrics`.
- Đưa chủ đề và kiểu hook hiệu quả vào prompt chấm ý tưởng và viết kịch bản.

**Đã có (2026-10-18):** `packages/publish/src/stats.ts` (`npm run stats`, chạy trong mỗi lần daily) lưu `data/stats.json`.
- **YouTube:** lấy lượt xem, thích, bình luận của các video trên kênh.
- **TikTok:** cần thêm product *Display API* (scope `video.list`) trong TikTok developer portal, rồi chạy `npm run tt:auth`. Hiện còn lỗi `scope_not_authorized`.
- Tab **Thống kê** trong app:
  - tổng lượt xem theo nền tảng;
  - lượt xem theo khung giờ đăng (giờ VN, chỉ tính video đã đăng hơn 48h) kèm gợi ý giờ đăng;
  - so sánh 2 định dạng;
  - bảng từng video với tỉ lệ tương tác.
- **Chưa làm:** retention, tự đưa kết quả vào prompt, tự chỉnh tỉ lệ format.

---

## 4. Rủi ro cần biết trước

- **Đăng qua API bị giới hạn khi chưa audit:**
  - YouTube: theo chính sách, video upload từ project API chưa xác minh có thể **bị khoá ở chế độ riêng tư**. Thực tế 2026-10-18: video của kênh vẫn chuyển sang công khai được.
  - TikTok: client chưa audit chỉ đăng được riêng tư, hoặc gửi vào **hộp nháp** để bạn bấm đăng (đang dùng cách này).
  - Vì vậy phải nộp audit từ Phase 0. Trong lúc chờ, tool vẫn sản xuất video, chỉ khâu đăng là tạm thời bán tự động.
- **Chính sách kiếm tiền:** YouTube hạn chế nội dung "sản xuất hàng loạt / lặp lại". Pipeline giảm rủi ro bằng: nhân vật riêng, nhiều template, QA chống chép, gắn nhãn AI, và không đăng quá dày (khởi đầu 1–3 video/ngày/kênh).
- **edge-tts** là API không chính thức của Microsoft, có thể đổi bất cứ lúc nào. Luôn giữ Gemini TTS làm phương án dự phòng.
- **Hạn mức free tier của Gemini** có thể thay đổi. Bộ đếm hạn mức ở Phase 2 giúp tool tự chậm lại thay vì sập.

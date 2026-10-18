// Viết lại caption + hashtag cho video đã làm (theo công thức mới ở captions.ts), không render lại.
//   npm run recaption              -> các ngày từ hôm nay trở đi
//   npm run recaption -- 2026-10-17 -> một ngày
// Video đã đẩy nháp lên TikTok/YouTube thì caption trên đó không đổi theo (sửa lúc bấm đăng).
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createDb, loadEnv, migrateDb, parseCaption, videosRoot} from '@viup/core';
import {captionText, suggestHooks} from './captions.ts';

loadEnv();
const db = createDb();
await migrateDb(db);

const today = new Date().toLocaleDateString('sv');
const arg = process.argv[2];
const days = existsSync(videosRoot())
	? readdirSync(videosRoot()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (arg ? d === arg : d >= today))
	: [];

for (const day of days.sort()) {
	const dir = join(videosRoot(), day);
	for (const f of readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
		const path = join(dir, f);
		const txt = readFileSync(path, 'utf8');
		const c = parseCaption(txt);
		const title = c.youtubeTitle.replace(/\s*#Shorts$/, '');
		// Lời thoại = phần mô tả trước dòng chân "Crab vibe — ..." (bỏ câu hỏi nếu file đã theo công thức mới)
		const script0 = c.description.split('\n\nCrab vibe')[0];
		const script = txt.includes('\nĐịnh dạng: ') ? script0.slice(script0.indexOf('\n') + 1) : script0;
		const hooks = await suggestHooks(db, {title, topic: c.topic, format: c.format});
		writeFileSync(path, captionText({day, topic: c.topic, format: c.format, title, script: script.trim(), hooks}));
		console.log(`✓ ${day}/${f}: ${[...hooks.hashtags].join(' ')} | ${hooks.question}`);
	}
}

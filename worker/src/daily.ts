// Phase 4: chạy hằng ngày (systemd timer gọi, xem install-timer.ts):
// làm đủ video cho hôm nay + ngày mai (make --auto --days 2), đẩy nháp TikTok/YouTube video hôm nay, lấy số liệu,
// ghi log, báo kết quả, dọn video cũ.
// Chạy tay: npm run daily
import {spawn} from 'node:child_process';
import {appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync, statSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createDb, findRepoRoot, loadEnv, migrateDb, schema} from '@viup/core';

loadEnv();
const root = findRepoRoot();
const KEEP_DAYS = Number(process.env.VIUP_KEEP_DAYS ?? 14);
const today = new Date().toLocaleDateString('sv');
const logDir = join(root, 'data', 'logs');
mkdirSync(logDir, {recursive: true});
const logFile = join(logDir, `${today}.log`);
const log = (s: string) => {
	const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${s}`;
	console.log(line);
	appendFileSync(logFile, `${line}\n`);
};

// Báo kết quả: thông báo trên màn hình (notify-send) + Telegram nếu có TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong .env
const notify = async (title: string, body: string) => {
	spawn('notify-send', ['-a', 'viup', title, body], {stdio: 'ignore'}).on('error', () => {});
	const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat} = process.env;
	if (!token || !chat) return;
	await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({chat_id: chat, text: `${title}\n${body}`}),
	}).catch((e) => log(`Telegram lỗi: ${e}`));
};

// Tắt "Tự động làm video" trong app (Cài đặt) -> hẹn giờ bỏ qua; chạy tay (npm run daily / nút trong app) vẫn làm
if (process.env.INVOCATION_ID) {
	const db = createDb();
	await migrateDb(db);
	const [channel] = await db.select({active: schema.channels.active}).from(schema.channels).limit(1);
	if (channel && !channel.active) {
		log('Kênh đang tạm dừng (Cài đặt trong app) — bỏ qua lần chạy theo giờ.');
		process.exit(0);
	}
}

// Khoá để 2 lần chạy (timer + chạy tay) không đè nhau
const lock = join(root, 'data', 'daily.lock');
if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 3 * 3600_000) {
	log('Đang có lần chạy khác, bỏ qua.');
	process.exit(0);
}
closeSync(openSync(lock, 'w'));

// Chạy 1 bước (script node) và chép output vào log
const step = (args: string[]) =>
	new Promise<number>((resolve) => {
		const p = spawn(process.execPath, args, {cwd: root});
		const onData = (b: Buffer) => {
			// Bỏ dòng tiến độ render cho log gọn
			for (const line of b.toString().split('\n')) if (line.trim() && !/^(Encoded|Rendered|Bundl|Getting|Composition|Codec|Concurrency|\[\d+\/\d+\])/.test(line)) log(line);
		};
		p.stdout.on('data', onData);
		p.stderr.on('data', onData);
		p.on('close', (c) => resolve(c ?? 1));
	});

const countVideos = (day: string) => {
	const dir = join(root, 'videos', day);
	return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp4')).length : 0;
};

try {
	log('=== Bắt đầu: làm video cho hôm nay + ngày mai ===');
	const code = await step(['packages/brain/src/make.ts', '--auto', '--days', '2', '--ahead', '1']);

	// Đẩy video hôm nay vào nháp TikTok + YouTube (riêng tư), rồi lấy số liệu cho trang Thống kê.
	// Chỉ đẩy ngày hôm nay: TikTok giới hạn số nháp đang chờ (~5/24h).
	log('=== Đẩy nháp video hôm nay ===');
	const drafts = await step(['packages/publish/src/cli.ts', 'drafts', today]);
	await step(['packages/publish/src/cli.ts', 'stats']);

	// Dọn thư mục ngày đã qua quá KEEP_DAYS ngày
	const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toLocaleDateString('sv');
	const videosDir = join(root, 'videos');
	for (const d of existsSync(videosDir) ? readdirSync(videosDir) : []) {
		if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) {
			rmSync(join(videosDir, d), {recursive: true, force: true});
			log(`Đã xoá video cũ: videos/${d}`);
		}
	}
	for (const f of readdirSync(logDir)) if (f.slice(0, 10) < cutoff) rmSync(join(logDir, f), {force: true});

	const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('sv');
	const summary = `Hôm nay ${countVideos(today)} video, ngày mai ${countVideos(tomorrow)} video (thư mục videos/).`;
	log(summary);
	const draftNote = drafts === 0 ? 'Đã đẩy nháp TikTok + YouTube cho video hôm nay.' : 'Đẩy nháp có lỗi, xem log (lần chạy sau thử lại).';
	log(draftNote);
	if (code === 0) await notify('viup: đã làm video', `${summary}\n${draftNote}`);
	else await notify('viup: chưa làm đủ video', `${summary}\nXem log: data/logs/${today}.log (thường do hết lượt Gemini, lần chạy sau sẽ làm bù).`);
	log('=== Xong ===');
} catch (e) {
	log(`LỖI: ${(e as Error).stack ?? e}`);
	await notify('viup: lỗi khi chạy hằng ngày', `${(e as Error).message}\nXem data/logs/${today}.log`);
	process.exitCode = 1;
} finally {
	unlinkSync(lock);
}

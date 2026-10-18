import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {findRepoRoot, loadEnv} from '@viup/core';
import {pushDrafts} from './drafts.ts';
import {refreshStats} from './stats.ts';
import {tiktokAuth, tiktokUpload} from './tiktok.ts';
import {youtubeAuth, youtubeUpload} from './youtube.ts';

loadEnv();

const [command, ...rest] = process.argv.slice(2);
const {values, positionals} = parseArgs({
	args: rest,
	allowPositionals: true,
	options: {
		title: {type: 'string'},
		description: {type: 'string'},
		privacy: {type: 'string', default: 'private'},
	},
});

switch (command) {
	case 'youtube:auth':
		await youtubeAuth();
		break;
	case 'youtube:upload': {
		// Không truyền gì -> dùng video vừa render + tiêu đề/mô tả lấy từ kịch bản
		const video = join(findRepoRoot(), 'packages', 'video');
		const file = positionals[0] ?? join(video, 'out', 'short.mp4');
		if (!existsSync(file)) {
			console.error(`Không thấy file ${file} — render trước: npm run render -w @viup/video`);
			process.exit(1);
		}
		const lines: {text: string}[] = JSON.parse(readFileSync(join(video, 'public', 'manifest.json'), 'utf8')).lines;
		const title = values.title ?? `${lines[0].text.slice(0, 90)} #Shorts`;
		const description =
			values.description ??
			`${lines.map((l) => l.text).join(' ')}\n\nCrab vibe — video tạo tự động bằng viup (nội dung có hỗ trợ AI).\n#Shorts #CrabVibe`;
		console.log(`Đang upload ${file}\nTiêu đề: ${title}`);
		const result = await youtubeUpload({
			file,
			title,
			description,
			privacy: values.privacy as 'private' | 'unlisted' | 'public',
		});
		console.log(`Xong: ${result.url} (trạng thái: ${result.privacy})`);
		break;
	}
	case 'tiktok:auth':
		await tiktokAuth();
		break;
	case 'tiktok:upload': {
		// Không truyền gì -> video mới làm gần nhất trong videos/<ngày>/
		const videos = join(findRepoRoot(), 'videos');
		const latest = existsSync(videos)
			? readdirSync(videos, {recursive: true, encoding: 'utf8'})
					.filter((f) => f.endsWith('.mp4'))
					.map((f) => join(videos, f))
					.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
			: undefined;
		const file = positionals[0] ?? latest;
		if (!file || !existsSync(file)) {
			console.error(`Không thấy video ${file ?? ''} — tạo trước: npm run make -- "chủ đề"`);
			process.exit(1);
		}
		console.log(`Đang đẩy ${file} vào nháp TikTok...`);
		const r = await tiktokUpload(file);
		console.log(`Mã theo dõi: ${r.publishId}`);
		console.log(r.status === 'PROCESSING_UPLOAD' ? 'TikTok vẫn đang xử lý, vài phút nữa xem trong app.' : 'Xong: mở app TikTok → hộp thư (Inbox) / thông báo → chỉnh và đăng.');
		// Caption nằm cạnh video (do npm run make tạo)
		const txt = file.replace(/\.mp4$/, '.txt');
		if (existsSync(txt)) console.log(`Caption: xem ${txt}`);
		break;
	}
	case 'drafts': {
		// Đẩy nháp TikTok + YouTube (riêng tư) cho 1 ngày đăng, mặc định hôm nay
		const day = positionals[0] ?? new Date().toLocaleDateString('sv');
		const r = await pushDrafts(day);
		console.log(`Xong ${day}: ${r.done.length} đã đẩy, ${r.failed.length} lỗi${r.done.length + r.failed.length ? '' : ' (không có gì mới)'}`);
		if (r.failed.length) process.exitCode = 2;
		break;
	}
	case 'stats': {
		const s = await refreshStats();
		for (const p of ['youtube', 'tiktok'])
			console.log(`${p}: ${s.items.filter((i) => i.platform === p).length} video${s.errors[p] ? ` — lỗi: ${s.errors[p]}` : ''}`);
		break;
	}
	default:
		console.log('Lệnh: drafts [YYYY-MM-DD] | stats | youtube:auth | youtube:upload [file.mp4] [--title "..."] [--description "..."] | tiktok:auth | tiktok:upload [file.mp4]');
		process.exitCode = 1;
}

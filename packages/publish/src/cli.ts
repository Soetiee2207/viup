import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {findRepoRoot, loadEnv} from '@viup/core';
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
	default:
		console.log('Lệnh: youtube:auth | youtube:upload [file.mp4] [--title "..."] [--description "..."]');
		process.exitCode = 1;
}

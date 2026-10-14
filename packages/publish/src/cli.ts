import {parseArgs} from 'node:util';
import {loadEnv} from '@viup/core';
import {youtubeAuth, youtubeUpload} from './youtube.ts';

loadEnv();

const [command, ...rest] = process.argv.slice(2);
const {values, positionals} = parseArgs({
	args: rest,
	allowPositionals: true,
	options: {
		title: {type: 'string'},
		description: {type: 'string', default: ''},
		privacy: {type: 'string', default: 'private'},
	},
});

switch (command) {
	case 'youtube:auth':
		await youtubeAuth();
		break;
	case 'youtube:upload': {
		const file = positionals[0];
		if (!file || !values.title) throw new Error('Dùng: youtube:upload <file.mp4> --title "..." [--description "..."]');
		console.log(`Đang upload ${file}…`);
		const result = await youtubeUpload({
			file,
			title: values.title,
			description: values.description,
			privacy: values.privacy as 'private' | 'unlisted' | 'public',
		});
		console.log(`Xong: ${result.url} (trạng thái: ${result.privacy})`);
		break;
	}
	default:
		console.log('Lệnh: youtube:auth | youtube:upload <file.mp4> --title "..."');
		process.exitCode = 1;
}

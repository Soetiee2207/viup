// Tự đẩy video của một ngày đăng lên làm nháp: TikTok (hộp thư nháp) + YouTube (riêng tư). Bạn vào app bấm đăng khi muốn.
// Nhớ đã đẩy cái nào trong videos/<ngày>/uploads.json -> chạy lại không đẩy trùng; lỗi thì lần chạy sau thử lại.
import {existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {readCaption, readPublishSettings, readUploads, videosRoot, writeUploads} from '@viup/core';
import {tiktokUpload} from './tiktok.ts';
import {youtubeUpload} from './youtube.ts';

export type DraftResult = {done: string[]; failed: string[]};

export const pushDrafts = async (day: string, log: (s: string) => void = console.log): Promise<DraftResult> => {
	const dir = join(videosRoot(), day);
	const result: DraftResult = {done: [], failed: []};
	if (!existsSync(dir)) return result;
	const settings = readPublishSettings();
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.mp4'))
		.sort((a, b) => parseInt(a) - parseInt(b));

	for (const file of files) {
		const c = readCaption(join(dir, file));
		const jobs = {
			youtube: async () => {
				const r = await youtubeUpload({file: join(dir, file), title: c.youtubeTitle || c.topic, description: c.description, privacy: 'private'});
				return {id: r.id, url: `https://studio.youtube.com/video/${r.id}/edit`};
			},
			tiktok: async () => {
				const r = await tiktokUpload(join(dir, file));
				return {id: r.publishId};
			},
		};
		for (const platform of ['tiktok', 'youtube'] as const) {
			if (!settings[platform]) continue;
			const uploads = readUploads(day);
			if (uploads[file]?.[platform]?.id) continue;
			log(`• Đẩy nháp ${platform}: ${day}/${file}`);
			try {
				const r = await jobs[platform]();
				uploads[file] = {...uploads[file], [platform]: {at: new Date().toISOString(), ...r}};
				result.done.push(`${platform}:${file}`);
				log(`  ✓ ${platform} xong${'url' in r ? `: ${r.url}` : ''}`);
			} catch (e) {
				const msg = (e as Error).message.slice(0, 300);
				uploads[file] = {...uploads[file], [platform]: {at: new Date().toISOString(), error: msg}};
				result.failed.push(`${platform}:${file}`);
				log(`  ✗ ${platform} lỗi: ${msg}`);
			}
			writeUploads(day, uploads);
		}
	}
	return result;
};

// Thư mục videos/<ngày đăng>/: đọc caption (.txt), trạng thái đẩy nháp (uploads.json), cài đặt đăng (data/publish.json)
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {findRepoRoot} from './db.ts';

export const videosRoot = () => join(findRepoRoot(), 'videos');

const readJson = <T>(path: string, fallback: T): T => {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return fallback;
	}
};
const writeJson = (path: string, data: unknown) => {
	mkdirSync(join(path, '..'), {recursive: true});
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};

export type Caption = {day: string; topic: string; format: string; youtubeTitle: string; caption: string; description: string};

// Tách các mục trong file .txt do `npm run make` tạo
export const parseCaption = (txt: string): Caption => {
	const section = (header: string) => {
		const i = txt.indexOf(`${header}\n`);
		return i < 0 ? '' : txt.slice(i + header.length + 1).split(/\n\n/)[0].trim();
	};
	const youtubeTitle = section('YouTube (tiêu đề):');
	const topic = txt.match(/^Chủ đề: (.*)$/m)?.[1] ?? youtubeTitle.replace(/ #Shorts$/, '');
	const i = txt.indexOf('Mô tả YouTube:\n');
	return {
		day: txt.match(/^Ngày đăng: (.*)$/m)?.[1] ?? '',
		topic,
		// File cũ chưa ghi định dạng -> đoán theo chủ đề
		format: txt.match(/^Định dạng: (.*)$/m)?.[1] ?? (/cung|hoàng đạo|cự giải|zodiac/i.test(topic) ? 'zodiac' : 'fun-fact'),
		youtubeTitle,
		caption: section('TikTok / Facebook (caption):'),
		description: i < 0 ? '' : txt.slice(i + 15).split('\n\nNhớ bật')[0].trim(),
	};
};
export const readCaption = (mp4: string) => {
	const txt = mp4.replace(/\.mp4$/, '.txt');
	return parseCaption(existsSync(txt) ? readFileSync(txt, 'utf8') : '');
};

// Đã đẩy nháp lên đâu: {"1-abc.mp4": {"tiktok": {...}, "youtube": {...}}}
export type UploadRecord = {at: string; id?: string; url?: string; error?: string};
export type Uploads = Record<string, Partial<Record<'tiktok' | 'youtube', UploadRecord>>>;
const uploadsFile = (day: string) => join(videosRoot(), day, 'uploads.json');
export const readUploads = (day: string) => readJson<Uploads>(uploadsFile(day), {});
export const writeUploads = (day: string, data: Uploads) => writeJson(uploadsFile(day), data);

// Bật/tắt tự đẩy nháp từng nền tảng (sửa trong app: Cài đặt)
export type PublishSettings = {tiktok: boolean; youtube: boolean};
const settingsFile = () => join(findRepoRoot(), 'data', 'publish.json');
export const readPublishSettings = (): PublishSettings => ({tiktok: true, youtube: true, ...readJson<Partial<PublishSettings>>(settingsFile(), {})});
export const writePublishSettings = (s: PublishSettings) => writeJson(settingsFile(), s);

// Số liệu xem/thích lấy về từ các nền tảng (npm run stats), lưu bản mới nhất
export type StatItem = {
	platform: 'youtube' | 'tiktok';
	id: string;
	title: string;
	url: string;
	publishedAt: string; // ISO
	privacy?: string;
	views: number;
	likes: number;
	comments: number;
	shares?: number;
};
export type StatsSnapshot = {fetchedAt: string; items: StatItem[]; errors: Record<string, string>};
const statsFile = () => join(findRepoRoot(), 'data', 'stats.json');
export const readStats = () => readJson<StatsSnapshot | null>(statsFile(), null);
export const writeStats = (s: StatsSnapshot) => writeJson(statsFile(), s);

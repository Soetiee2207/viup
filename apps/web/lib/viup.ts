// Đọc trạng thái tool từ ổ đĩa + DB cho giao diện (chỉ chạy phía server)
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, resolve, sep} from 'node:path';
import {and, gte, inArray, sql} from 'drizzle-orm';
import {findRepoRoot, schema, type Db} from '@viup/core';

export const root = findRepoRoot();
export const videosDir = join(root, 'videos');
export const logDir = join(root, 'data', 'logs');
export const lockFile = join(root, 'data', 'daily.lock');

export const PLATFORMS = ['tiktok', 'youtube', 'facebook'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = {tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook'};

export const localDate = (d = new Date()) => d.toLocaleDateString('sv');
export const addDays = (day: string, n: number) => {
	const d = new Date(`${day}T12:00:00`);
	d.setDate(d.getDate() + n);
	return localDate(d);
};

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const listDays = () => (existsSync(videosDir) ? readdirSync(videosDir).filter(isDay).sort() : []);

// Chặn đường dẫn thoát ra ngoài videos/
export const safeVideoPath = (...parts: string[]) => {
	const p = resolve(videosDir, ...parts);
	if (!p.startsWith(videosDir + sep)) throw new Error('Đường dẫn không hợp lệ');
	return p;
};

type Posted = Record<string, Partial<Record<Platform, boolean>>>;
const postedFile = (day: string) => safeVideoPath(day, 'posted.json');
export const readPosted = (day: string): Posted => {
	try {
		return JSON.parse(readFileSync(postedFile(day), 'utf8'));
	} catch {
		return {};
	}
};
export const writePosted = (day: string, data: Posted) => writeFileSync(postedFile(day), `${JSON.stringify(data, null, 2)}\n`);

export type VideoItem = {
	file: string;
	name: string;
	topic: string;
	youtubeTitle: string;
	caption: string;
	description: string;
	posted: Partial<Record<Platform, boolean>>;
	sizeMb: number;
};

// Tách các mục trong file .txt do `npm run make` tạo
const section = (txt: string, header: string) => {
	const i = txt.indexOf(`${header}\n`);
	if (i < 0) return '';
	return txt.slice(i + header.length + 1).split(/\n\n/)[0].trim();
};

export const listVideos = (day: string): VideoItem[] => {
	const dir = safeVideoPath(day);
	if (!existsSync(dir)) return [];
	const posted = readPosted(day);
	return readdirSync(dir)
		.filter((f) => f.endsWith('.mp4'))
		.sort((a, b) => parseInt(a) - parseInt(b))
		.map((file) => {
			const txtPath = join(dir, file.replace(/\.mp4$/, '.txt'));
			const txt = existsSync(txtPath) ? readFileSync(txtPath, 'utf8') : '';
			const youtubeTitle = section(txt, 'YouTube (tiêu đề):');
			return {
				file,
				name: file.replace(/\.mp4$/, ''),
				topic: txt.match(/^Chủ đề: (.*)$/m)?.[1] ?? youtubeTitle.replace(/ #Shorts$/, ''),
				youtubeTitle,
				caption: section(txt, 'TikTok / Facebook (caption):'),
				description: txt.includes('Mô tả YouTube:\n') ? txt.slice(txt.indexOf('Mô tả YouTube:\n') + 15).split('\n\nNhớ bật')[0].trim() : '',
				posted: posted[file] ?? {},
				sizeMb: statSync(join(dir, file)).size / 1e6,
			};
		});
};

// Lần chạy tự động kế tiếp (systemd timer)
export const timerInfo = () => {
	try {
		const out = execFileSync('systemctl', ['--user', 'show', 'viup-daily.timer', '-p', 'ActiveState', '-p', 'NextElapseUSecRealtime', '-p', 'LastTriggerUSec'], {encoding: 'utf8'});
		const v = Object.fromEntries(out.trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
		return {installed: v.ActiveState === 'active', next: v.NextElapseUSecRealtime || null, last: v.LastTriggerUSec && v.LastTriggerUSec !== 'n/a' ? v.LastTriggerUSec : null};
	} catch {
		return {installed: false, next: null, last: null};
	}
};

export const isRunning = () => existsSync(lockFile) && Date.now() - statSync(lockFile).mtimeMs < 3 * 3600_000;

export const readLog = (day: string, lines = 200) => {
	const f = join(logDir, `${day}.log`);
	if (!isDay(day) || !existsSync(f)) return '';
	return readFileSync(f, 'utf8').split('\n').slice(-lines).join('\n');
};
export const listLogs = () => (existsSync(logDir) ? readdirSync(logDir).map((f) => f.replace(/\.log$/, '')).filter(isDay).sort().reverse() : []);

// Lượt Gemini hôm nay (ngày tính theo giờ Thái Bình Dương, như Google)
const pacificDayStart = () => {
	const now = new Date();
	const pt = new Date(now.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
	const offset = now.getTime() - pt.getTime();
	pt.setHours(0, 0, 0, 0);
	return new Date(pt.getTime() + offset);
};
export const geminiUsage = async (db: Db) =>
	db
		.select({model: schema.apiCalls.model, n: sql<number>`count(*)`})
		.from(schema.apiCalls)
		.where(and(gte(schema.apiCalls.createdAt, pacificDayStart()), inArray(schema.apiCalls.status, ['ok', 'pending'])))
		.groupBy(schema.apiCalls.model);

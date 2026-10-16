'use server';
// Các nút bấm trên giao diện. App chỉ nghe ở 127.0.0.1 (máy của bạn) nên không cần đăng nhập.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {eq} from 'drizzle-orm';
import {revalidatePath} from 'next/cache';
import {ensureDefaultChannel, schema} from '@viup/core';
import {getDb} from '@/lib/db';
import {isRunning, PLATFORMS, readPosted, root, safeVideoPath, writePosted, type Platform} from '@/lib/viup';

const runDetached = (script: string, args: string[] = []) => {
	// Bỏ INVOCATION_ID (app chạy dưới systemd) để daily.ts biết đây là bấm tay, không phải hẹn giờ
	const {INVOCATION_ID: _, ...env} = process.env;
	spawn(process.execPath, [join(root, script), ...args], {cwd: root, detached: true, stdio: 'ignore', env}).unref();
};

export async function togglePosted(day: string, file: string, platform: Platform) {
	if (!PLATFORMS.includes(platform)) return;
	safeVideoPath(day, file);
	const posted = readPosted(day);
	const cur = posted[file] ?? {};
	posted[file] = {...cur, [platform]: !cur[platform]};
	writePosted(day, posted);
	revalidatePath('/');
}

// Xoá video không ưng; lần chạy tự động sau sẽ làm video khác bù vào
export async function deleteVideo(day: string, file: string) {
	const mp4 = safeVideoPath(day, file);
	if (!mp4.endsWith('.mp4')) return;
	rmSync(mp4, {force: true});
	rmSync(mp4.replace(/\.mp4$/, '.txt'), {force: true});
	revalidatePath('/');
}

export async function runDaily() {
	if (!isRunning()) runDetached('worker/src/daily.ts');
	await new Promise((r) => setTimeout(r, 800));
	revalidatePath('/', 'layout');
}

export async function discoverIdeas() {
	runDetached('packages/brain/src/make.ts', ['--ideas', '--discover']);
	await new Promise((r) => setTimeout(r, 500));
	revalidatePath('/ideas');
}

const fingerprint = (topic: string) =>
	createHash('sha1')
		.update(topic.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
		.digest('hex');

// Chủ đề tự thêm được điểm cao nhất -> lần chạy tới làm trước
export async function addIdea(formData: FormData) {
	const title = String(formData.get('title') ?? '').trim();
	const format = String(formData.get('format') ?? 'fun-fact');
	if (!title) return;
	const db = await getDb();
	await ensureDefaultChannel(db);
	const [channel] = await db.select().from(schema.channels).limit(1);
	await db
		.insert(schema.ideas)
		.values({channelId: channel.id, format, title, summary: 'Thêm tay từ app', fingerprint: fingerprint(title), score: 99})
		.onConflictDoUpdate({target: [schema.ideas.channelId, schema.ideas.fingerprint], set: {status: 'new', score: 99}});
	revalidatePath('/ideas');
}

export async function rejectIdea(id: number) {
	const db = await getDb();
	await db.update(schema.ideas).set({status: 'rejected'}).where(eq(schema.ideas.id, id));
	revalidatePath('/ideas');
}

export async function saveSettings(formData: FormData) {
	const db = await getDb();
	await ensureDefaultChannel(db);
	const [channel] = await db.select().from(schema.channels).limit(1);
	const perDay = Math.min(10, Math.max(1, Number(formData.get('videosPerDay')) || 3));
	const fun = Math.min(100, Math.max(0, Number(formData.get('funFact')) || 0)) / 100;
	await db
		.update(schema.channels)
		.set({videosPerDay: perDay, formats: {'fun-fact': fun, zodiac: Math.round((1 - fun) * 100) / 100}, active: formData.get('active') === 'on'})
		.where(eq(schema.channels.id, channel.id));
	revalidatePath('/', 'layout');
}

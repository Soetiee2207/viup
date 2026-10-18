// Lấy số liệu từ YouTube + TikTok, lưu data/stats.json cho trang Thống kê trong app (npm run stats; daily cũng chạy)
import {readStats, writeStats, type StatsSnapshot} from '@viup/core';
import {tiktokStats} from './tiktok.ts';
import {youtubeStats} from './youtube.ts';

export const refreshStats = async (): Promise<StatsSnapshot> => {
	const prev = readStats();
	const snap: StatsSnapshot = {fetchedAt: new Date().toISOString(), items: [], errors: {}};
	for (const [platform, fetcher] of [['youtube', youtubeStats], ['tiktok', tiktokStats]] as const) {
		try {
			snap.items.push(...(await fetcher()));
		} catch (e) {
			snap.errors[platform] = (e as Error).message.slice(0, 300);
			// Lỗi thì giữ số liệu cũ của nền tảng đó
			snap.items.push(...(prev?.items.filter((i) => i.platform === platform) ?? []));
		}
	}
	writeStats(snap);
	return snap;
};

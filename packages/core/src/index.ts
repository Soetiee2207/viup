import type {Db} from './db.ts';
import {channels} from './schema.ts';

export * from './db.ts';
export * from './queue.ts';
export * as schema from './schema.ts';
export type {Channel, FormatWeights, Job} from './schema.ts';

// Kênh mặc định theo docs/PLAN.md (mục 1b, 1c)
export const ensureDefaultChannel = async (db: Db) => {
	const existing = await db.select({id: channels.id}).from(channels).limit(1);
	if (existing.length) return;
	await db.insert(channels).values({
		name: 'Cua Biết Tuốt',
		formats: {'fun-fact': 0.6, zodiac: 0.4},
		character: 'crab',
		voice: 'vi-VN-HoaiMyNeural',
		schedule: '0 11,19 * * *',
		videosPerDay: 2,
	});
};

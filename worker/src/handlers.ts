import type {Db, Job} from '@viup/core';

export type Handler = (job: Job, ctx: {db: Db}) => Promise<void>;

// Mỗi bước pipeline (discover, script, tts, render, upload…) đăng ký một handler ở đây
export const handlers: Record<string, Handler> = {
	ping: async (job) => {
		console.log(`[ping] job #${job.id}`, job.payload);
	},
};

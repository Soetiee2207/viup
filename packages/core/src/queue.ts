import {and, asc, eq, lt, lte, sql} from 'drizzle-orm';
import type {Db} from './db.ts';
import {jobs, type Job} from './schema.ts';

const STALE_MS = 30 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;

export const enqueue = async (
	db: Db,
	type: string,
	payload: Record<string, unknown> = {},
	opts: {runAfter?: Date; maxAttempts?: number} = {},
) => {
	const [job] = await db
		.insert(jobs)
		.values({type, payload, runAfter: opts.runAfter ?? new Date(), maxAttempts: opts.maxAttempts ?? 3})
		.returning();
	return job;
};

// Lấy 1 job đến hạn và khoá nó trong cùng một câu lệnh (an toàn khi chạy nhiều worker)
export const claimNext = async (db: Db): Promise<Job | undefined> => {
	const now = new Date();
	const next = db
		.select({id: jobs.id})
		.from(jobs)
		.where(and(eq(jobs.status, 'queued'), lte(jobs.runAfter, now)))
		.orderBy(asc(jobs.runAfter))
		.limit(1);
	const [job] = await db
		.update(jobs)
		.set({status: 'running', lockedAt: now, updatedAt: now})
		.where(and(eq(jobs.id, sql`(${next})`), eq(jobs.status, 'queued')))
		.returning();
	return job;
};

export const completeJob = async (db: Db, id: number) => {
	await db.update(jobs).set({status: 'done', error: null, updatedAt: new Date()}).where(eq(jobs.id, id));
};

// Lỗi -> thử lại với backoff tăng dần (30s, 60s, 120s…), quá số lần thì đánh dấu failed
export const failJob = async (db: Db, job: Job, error: unknown) => {
	const attempts = job.attempts + 1;
	const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
	const giveUp = attempts >= job.maxAttempts;
	await db
		.update(jobs)
		.set({
			status: giveUp ? 'failed' : 'queued',
			attempts,
			error: message.slice(0, 4000),
			runAfter: new Date(Date.now() + BASE_BACKOFF_MS * 2 ** (attempts - 1)),
			lockedAt: null,
			updatedAt: new Date(),
		})
		.where(eq(jobs.id, job.id));
	return giveUp;
};

// Job đang "running" quá lâu (worker chết giữa chừng) -> trả về hàng đợi
export const requeueStale = async (db: Db) => {
	const cutoff = new Date(Date.now() - STALE_MS);
	const rows = await db
		.update(jobs)
		.set({status: 'queued', lockedAt: null, updatedAt: new Date()})
		.where(and(eq(jobs.status, 'running'), lt(jobs.lockedAt, cutoff)))
		.returning({id: jobs.id});
	return rows.length;
};

export const jobStats = async (db: Db) => {
	const rows = await db
		.select({status: jobs.status, count: sql<number>`count(*)`})
		.from(jobs)
		.groupBy(jobs.status);
	return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) as Partial<Record<Job['status'], number>>;
};

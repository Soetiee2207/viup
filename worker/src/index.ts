import {claimNext, completeJob, createDb, ensureDefaultChannel, failJob, migrateDb, requeueStale} from '@viup/core';
import {handlers} from './handlers.ts';

const IDLE_MS = 2000;

const db = createDb();
await migrateDb(db);
await ensureDefaultChannel(db);
const recovered = await requeueStale(db);
console.log(`[worker] sẵn sàng${recovered ? `, trả lại ${recovered} job bị treo` : ''}`);

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		console.log('[worker] đang dừng sau job hiện tại…');
		stopping = true;
	});
}

while (!stopping) {
	const job = await claimNext(db);
	if (!job) {
		await new Promise((r) => setTimeout(r, IDLE_MS));
		continue;
	}
	const handler = handlers[job.type];
	try {
		if (!handler) throw new Error(`Không có handler cho job type "${job.type}"`);
		await handler(job, {db});
		await completeJob(db, job.id);
	} catch (err) {
		const gaveUp = await failJob(db, job, err);
		console.error(`[worker] job #${job.id} (${job.type}) lỗi${gaveUp ? ', bỏ cuộc' : ', sẽ thử lại'}:`, err);
	}
}
process.exit(0);

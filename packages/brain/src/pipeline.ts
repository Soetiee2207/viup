// Chủ đề -> kịch bản đã qua QA, lưu vào DB (ideas + scripts). Worker (Phase 4) gọi lại hàm này.
import {and, eq} from 'drizzle-orm';
import {ensureDefaultChannel, schema, type Db} from '@viup/core';
import {getFormat} from './formats.ts';
import {fingerprint} from './ideas.ts';
import {reviewScript, type QaReport} from './qa.ts';
import {findSource, type Source} from './source.ts';
import {validateSpec, type Check} from './validate.ts';
import {writeScript, type Draft} from './write.ts';

// 1 lần viết + tối đa 2 lần viết lại (docs/PLAN.md Phase 2)
export const MAX_ATTEMPTS = 3;

export type Attempt = {draft: Draft; check: Check; qa: QaReport | null};
export type ScriptResult = {
	ideaId: number;
	scriptId: number;
	pass: boolean;
	draft: Draft;
	attempts: Attempt[];
	sources: Source[];
};

const log = (msg: string) => console.log(msg);

export const makeScript = async (
	db: Db,
	opts: {topic: string; format?: string; sources?: Source[]},
): Promise<ScriptResult> => {
	const format = getFormat(opts.format ?? 'fun-fact');
	await ensureDefaultChannel(db);
	const [channel] = await db.select().from(schema.channels).limit(1);

	let sources = opts.sources ?? [];
	if (format.needsSource && sources.length === 0) {
		log('• Tìm nguồn trên Wikipedia...');
		sources = await findSource(db, opts.topic);
		if (sources.length === 0) throw new Error(`Không tìm được nguồn cho "${opts.topic}" — thử chủ đề khác hoặc truyền --source file.txt`);
		for (const s of sources) log(`  ${s.title} — ${s.url} (${s.text.length} ký tự)`);
	}

	// Ý tưởng: 1 dòng / chủ đề (chạy lại cùng chủ đề thì dùng lại)
	const fp = fingerprint(opts.topic);
	await db
		.insert(schema.ideas)
		.values({
			channelId: channel.id,
			format: format.id,
			title: opts.topic,
			summary: opts.topic,
			sourceUrl: sources.map((s) => s.url).join(' ') || null,
			sourceText: sources.map((s) => s.text).join('\n\n') || null,
			fingerprint: fp,
		})
		.onConflictDoNothing();
	const [idea] = await db
		.select({id: schema.ideas.id})
		.from(schema.ideas)
		.where(and(eq(schema.ideas.channelId, channel.id), eq(schema.ideas.fingerprint, fp)));

	const attempts: Attempt[] = [];
	let feedback: {draft: Draft; problems: string[]} | undefined;
	for (let i = 1; i <= MAX_ATTEMPTS; i++) {
		log(`• Viết kịch bản (lần ${i}/${MAX_ATTEMPTS})...`);
		const draft = await writeScript(db, {topic: opts.topic, format, sources, feedback});
		if (format.needsSource && !draft.covered) {
			log('  ✗ Nguồn không có thông tin cho chủ đề này — bỏ, không viết lại');
			attempts.push({draft, check: {errors: ['Nguồn không đủ thông tin cho chủ đề'], warnings: [], words: 0}, qa: null});
			break;
		}
		const check = validateSpec(draft.spec);
		for (const w of check.warnings) log(`  ⚠ ${w}`);
		if (check.errors.length) {
			for (const e of check.errors) log(`  ✗ ${e}`);
			attempts.push({draft, check, qa: null});
			feedback = {draft, problems: check.errors};
			continue;
		}
		log(`  ${draft.spec.lines.length} câu, ${check.words} chữ — "${draft.title}"`);
		log('• QA tự động...');
		const qa = await reviewScript(db, {topic: opts.topic, draft, format, sources});
		attempts.push({draft, check, qa});
		log(`  ${Object.entries(qa.scores).map(([k, v]) => `${k} ${v}`).join(' · ')} → ${qa.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
		if (qa.pass) break;
		const problems = qa.failed.flatMap((c) => qa.issues[c].map((s) => `[${c}] ${s}`));
		for (const p of problems) log(`  ✗ ${p}`);
		feedback = {draft, problems: problems.length ? problems : qa.failed.map((c) => `[${c}] điểm thấp, cần cải thiện`)};
	}

	const last = attempts.at(-1)!;
	const pass = last.qa?.pass ?? false;
	const [script] = await db
		.insert(schema.scripts)
		.values({
			ideaId: idea.id,
			spec: {...last.draft.spec, title: last.draft.title},
			qaReport: attempts.map((a) => ({title: a.draft.title, errors: a.check.errors, warnings: a.check.warnings, qa: a.qa, facts: a.draft.facts})),
			status: pass ? 'passed' : 'failed',
			attempts: attempts.length,
		})
		.returning({id: schema.scripts.id});
	await db
		.update(schema.ideas)
		.set({status: pass ? 'used' : 'rejected'})
		.where(eq(schema.ideas.id, idea.id));
	return {ideaId: idea.id, scriptId: script.id, pass, draft: last.draft, attempts, sources};
};

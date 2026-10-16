// Phase 3: tự tìm & chọn chủ đề mỗi ngày.
// Không có nguồn crawl miễn phí nào hợp ngách (Reddit chặn 403, "Did you know" của Wikipedia toàn chủ đề hẹp/chính trị),
// nên model lite (200 lượt/ngày) brainstorm theo nhóm chủ đề xoay vòng -> chấm điểm -> lọc trùng bằng code.
// Fun-fact được kiểm tra có nguồn thật ở bước viết (pipeline: covered=false thì bỏ, lấy ý tưởng kế tiếp).
import {createHash} from 'node:crypto';
import {and, desc, eq, inArray} from 'drizzle-orm';
import {ensureDefaultChannel, schema, type Db} from '@viup/core';
import {getFormat} from './formats.ts';
import {generateJson, models} from './gemini.ts';

export const fingerprint = (topic: string) =>
	createHash('sha1')
		.update(topic.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
		.digest('hex');

// Nhóm chủ đề xoay vòng theo ngày để kênh không lặp một kiểu
const THEMES: Record<string, string[]> = {
	'fun-fact': [
		'động vật kỳ lạ',
		'sinh vật biển và đại dương',
		'côn trùng',
		'chim',
		'vũ trụ và hành tinh',
		'khủng long và thời tiền sử',
		'thực vật kỳ lạ',
		'thú cưng (chó, mèo)',
		'hiện tượng tự nhiên, thời tiết',
		'phát minh và đồ vật quen thuộc',
		'lịch sử kỳ lạ, nền văn minh cổ',
		'địa lý, kỷ lục thế giới',
	],
	zodiac: [
		'xếp hạng top 3 cung theo một tính cách',
		'Cự Giải trong tình huống đời thường',
		'mỗi cung khi yêu / khi giận / khi buồn',
		'cung hoàng đạo và thói quen hằng ngày (ăn, ngủ, đi học, đi làm)',
		'cung nào hợp làm bạn thân / đồng nghiệp',
		'nhóm nguyên tố (Lửa, Đất, Khí, Nước)',
	],
};

const pickThemes = (format: string, k: number) => {
	const list = THEMES[format] ?? [];
	const day = Math.floor(Date.now() / 86_400_000);
	return Array.from({length: Math.min(k, list.length)}, (_, i) => list[(day * k + i) % list.length]);
};

// So độ giống bằng tập từ (không tốn AI): "bạch tuộc có 3 trái tim" ~ "vì sao bạch tuộc có ba trái tim"
const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));
const similar = (a: string, b: string) => {
	const x = tokens(a);
	const y = tokens(b);
	const inter = [...x].filter((w) => y.has(w)).length;
	return inter / Math.min(x.size, y.size || 1);
};
const isDuplicate = (title: string, existing: string[]) => existing.some((e) => similar(title, e) >= 0.7);

type Candidate = {title: string; angle: string; niche: number; viral: number; safety: number; sourceable: number};

const SCHEMA = {
	type: 'object',
	properties: {
		ideas: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					title: {type: 'string', description: 'Chủ đề video ngắn gọn bằng tiếng Việt, 4–12 chữ, như một câu hỏi/khẳng định gây tò mò'},
					angle: {type: 'string', description: 'Ý chính bất ngờ sẽ kể, 1 câu'},
					niche: {type: 'integer', minimum: 1, maximum: 5, description: 'Hợp kênh (mascot cua dễ thương, người xem 13–35 tuổi)'},
					viral: {type: 'integer', minimum: 1, maximum: 5, description: 'Khả năng gây tò mò, muốn xem hết, chia sẻ'},
					safety: {type: 'integer', minimum: 1, maximum: 5, description: '5 = hoàn toàn an toàn; thấp nếu dính sức khoẻ, chính trị, tôn giáo, bạo lực, người thật, tin nóng'},
					sourceable: {type: 'integer', minimum: 1, maximum: 5, description: 'Fun-fact: chắc chắn có trên Wikipedia và đúng khoa học. Zodiac: luôn 5'},
				},
				required: ['title', 'angle', 'niche', 'viral', 'safety', 'sourceable'],
			},
		},
	},
	required: ['ideas'],
};

const score = (c: Candidate) => (c.safety < 5 || c.sourceable < 4 ? 0 : c.niche + c.viral * 1.5 + c.sourceable * 0.5);

// Sinh ý tưởng mới cho 1 format, lưu vào bảng ideas (status new), trả về số ý tưởng đã thêm
export const discoverIdeas = async (db: Db, opts: {format: string; count?: number}) => {
	const format = getFormat(opts.format);
	await ensureDefaultChannel(db);
	const [channel] = await db.select().from(schema.channels).limit(1);
	const existing = (
		await db
			.select({title: schema.ideas.title})
			.from(schema.ideas)
			.where(eq(schema.ideas.channelId, channel.id))
			.orderBy(desc(schema.ideas.id))
			.limit(300)
	).map((r) => r.title);
	const themes = pickThemes(format.id, 3);
	const out = await generateJson<{ideas: Candidate[]}>(db, {
		system: `Bạn lên ý tưởng video YouTube Shorts / TikTok tiếng Việt cho kênh "Crab vibe" (mascot chú cua Cự Giải, giọng vui, dễ thương).
${format.writer}
Mỗi ý tưởng là MỘT điều cụ thể, bất ngờ, kể xong trong 30 giây. Không trùng các chủ đề đã làm. Tự chấm điểm trung thực.`,
		prompt: `Định dạng: ${format.id}
Nhóm chủ đề hôm nay: ${themes.join('; ')}
Cho ${opts.count ?? 12} ý tưởng.

ĐÃ LÀM / ĐÃ CÓ (không lặp lại, kể cả đổi cách nói):
${existing.slice(0, 150).join('\n') || '(chưa có)'}`,
		schema: SCHEMA,
		temperature: 1,
		models: [...models()].reverse(), // model lite: rẻ, đủ cho brainstorm
	});

	let added = 0;
	const seen = [...existing];
	for (const c of out.ideas) {
		const title = c.title.trim().replace(/[.!]+$/, '');
		const s = score(c);
		if (!title || s === 0 || isDuplicate(title, seen)) continue;
		seen.push(title);
		const rows = await db
			.insert(schema.ideas)
			.values({channelId: channel.id, format: format.id, title, summary: c.angle, fingerprint: fingerprint(title), score: s})
			.onConflictDoNothing()
			.returning({id: schema.ideas.id});
		added += rows.length;
	}
	return added;
};

// Chia N video theo tỉ lệ format của kênh, vd 3 video với 60/40 -> fun-fact 2, zodiac 1
export const planFormats = (weights: Record<string, number>, n: number) => {
	const entries = Object.entries(weights);
	const total = entries.reduce((s, [, w]) => s + w, 0);
	const alloc = entries.map(([f, w]) => ({f, exact: (w / total) * n, k: Math.floor((w / total) * n)}));
	let left = n - alloc.reduce((s, a) => s + a.k, 0);
	for (const a of [...alloc].sort((x, y) => y.exact - y.k - (x.exact - x.k))) if (left-- > 0) a.k++;
	return Object.fromEntries(alloc.map((a) => [a.f, a.k]));
};

// Ý tưởng tốt nhất chưa dùng của 1 format; hết thì tự brainstorm thêm
export const nextIdea = async (db: Db, format: string) => {
	const pick = () =>
		db
			.select()
			.from(schema.ideas)
			.where(and(eq(schema.ideas.format, format), eq(schema.ideas.status, 'new')))
			.orderBy(desc(schema.ideas.score), desc(schema.ideas.id))
			.limit(1);
	let [idea] = await pick();
	if (!idea) {
		await discoverIdeas(db, {format});
		[idea] = await pick();
	}
	if (!idea) return null;
	await db.update(schema.ideas).set({status: 'selected'}).where(eq(schema.ideas.id, idea.id));
	return idea;
};

export const listIdeas = (db: Db) =>
	db
		.select()
		.from(schema.ideas)
		.where(inArray(schema.ideas.status, ['new', 'selected']))
		.orderBy(schema.ideas.format, desc(schema.ideas.score));

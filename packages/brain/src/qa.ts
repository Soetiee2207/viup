// QA tự động thay người duyệt: lượt Gemini thứ hai chấm kịch bản theo từng tiêu chí (1–5).
// Quyết định đạt/không do code (ngưỡng PASS), không tin lời "đạt" của model.
import type {Db} from '@viup/core';
import type {Format} from './formats.ts';
import {generateJson} from './gemini.ts';
import type {Source} from './source.ts';
import type {Draft} from './write.ts';

const CRITERIA = ['topic', 'accuracy', 'essentials', 'safety', 'originality', 'hook', 'clarity'] as const;
type Criterion = (typeof CRITERIA)[number];

// Điểm tối thiểu để đạt
export const PASS: Record<Criterion, number> = {topic: 4, accuracy: 4, essentials: 4, safety: 5, originality: 4, hook: 4, clarity: 3};

export type QaReport = {
	scores: Record<Criterion, number>;
	issues: Record<Criterion, string[]>;
	pass: boolean;
	failed: Criterion[];
};

const criterion = {
	type: 'object',
	properties: {score: {type: 'integer', minimum: 1, maximum: 5}, issues: {type: 'array', items: {type: 'string'}}},
	required: ['score', 'issues'],
};

const SCHEMA = {
	type: 'object',
	properties: Object.fromEntries(CRITERIA.map((c) => [c, criterion])),
	required: [...CRITERIA],
};

const SYSTEM = `Bạn là biên tập viên kiểm duyệt nghiêm khắc cho kênh YouTube Shorts tiếng Việt "Crab vibe" (mascot chú cua). Video sẽ đăng tự động, KHÔNG có người duyệt sau bạn — thà đánh trượt còn hơn để lọt nội dung sai.

Chấm từng tiêu chí từ 1 (rất tệ) đến 5 (xuất sắc). "issues": liệt kê lỗi CỤ THỂ, chỉ rõ câu nào và cách sửa (tiếng Việt). Điểm 5 thì issues rỗng.
- topic: kịch bản có trả lời/nói ĐÚNG chủ đề được yêu cầu không? Lạc sang chủ đề khác (vd hỏi "hồng hạc" mà nói về "màu hồng") → 1.
- accuracy: độ chính xác (xem quy tắc riêng bên dưới).
- essentials: lời thoại có đủ thông tin cơ bản để người xem biết đang nói về cái gì (xem quy tắc riêng bên dưới). Chấm trên LỜI THOẠI (người xem chỉ nghe/đọc phụ đề).
- safety: không chính trị, tôn giáo, lời khuyên y tế/tài chính, bạo lực, tình dục, người thật còn sống, thương hiệu, xúc phạm nhóm người, nội dung không hợp trẻ em. Có bất kỳ vi phạm nào → ≤ 3.
- originality: không chép nguyên văn câu từ nguồn (≥ 8 chữ liên tiếp giống nguồn → ≤ 3), không sáo rỗng.
- hook: câu đầu + chữ hook có khiến người xem lướt Shorts dừng lại trong 3 giây không? Chào hỏi/dẫn dắt dài → ≤ 2.
- clarity: tiếng Việt tự nhiên, đúng chính tả, dễ hiểu khi NGHE (giọng máy đọc), các câu nối mạch lạc, câu cuối kêu gọi theo dõi.`;

export const reviewScript = async (
	db: Db,
	{topic, draft, format, sources}: {topic: string; draft: Draft; format: Format; sources: Source[]},
): Promise<QaReport> => {
	const script = draft.spec.lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n');
	const labels = draft.spec.lines.flatMap((l) => (l.beats ?? []).map((b) => b.label).filter(Boolean));
	const prompt = `CHỦ ĐỀ ĐƯỢC YÊU CẦU: ${topic}

QUY TẮC ACCURACY CHO ĐỊNH DẠNG "${format.id}":
${format.accuracy}

QUY TẮC ESSENTIALS:
${format.essentials}

--- KỊCH BẢN ---
Hook (chữ to đầu video): ${draft.spec.hook ?? ''}
Tiêu đề: ${draft.title}
${script}
Nhãn trên màn hình: ${labels.join(' | ') || '(không có)'}

--- FACTS người viết khai báo ---
${draft.facts.map((f) => `- ${f.claim} ⟵ "${f.evidence}"`).join('\n') || '(không có)'}

--- NGUỒN ---
${sources.map((s) => `[${s.title}]\n${s.text}`).join('\n\n') || '(không có — định dạng không cần nguồn)'}`;
	const raw = await generateJson<Record<Criterion, {score: number; issues: string[]}>>(db, {
		system: SYSTEM,
		prompt,
		schema: SCHEMA,
		temperature: 0.1,
	});
	const scores = Object.fromEntries(CRITERIA.map((c) => [c, raw[c]?.score ?? 1])) as Record<Criterion, number>;
	const issues = Object.fromEntries(CRITERIA.map((c) => [c, raw[c]?.issues ?? []])) as Record<Criterion, string[]>;
	const failed = CRITERIA.filter((c) => scores[c] < PASS[c]);
	return {scores, issues, pass: failed.length === 0, failed};
};

// Viết kịch bản: chủ đề + nguồn -> VideoSpec (Gemini, ép JSON schema)
import type {Db} from '@viup/core';
import type {VideoSpec} from '@viup/video/types';
import type {Format} from './formats.ts';
import {generateJson} from './gemini.ts';
import type {Source} from './source.ts';
import {iconNames, LIMITS} from './validate.ts';

export type Fact = {claim: string; evidence: string};
export type Subject = {name: string; scientificName?: string; where?: string};
export type Draft = {title: string; spec: VideoSpec; facts: Fact[]; covered: boolean; subject: Subject};

const EMOTIONS = ['vui', 'buon', 'ngacnhien', 'binhthuong'];
const LAYOUTS = ['crab-closeup', 'crab-presents', 'object-hero', 'versus', 'count'];

const SCHEMA = {
	type: 'object',
	properties: {
		title: {type: 'string', description: 'Tiêu đề YouTube, ≤ 70 ký tự, gây tò mò, không hashtag'},
		hook: {type: 'string', description: `Chữ to 2 giây đầu, 2–5 từ, ≤ ${LIMITS.maxHook} ký tự`},
		lines: {
			type: 'array',
			minItems: LIMITS.minLines,
			maxItems: LIMITS.maxLines,
			items: {
				type: 'object',
				properties: {
					text: {type: 'string'},
					emotion: {type: 'string', enum: EMOTIONS},
					beats: {
						type: 'array',
						minItems: 1,
						maxItems: 3,
						items: {
							type: 'object',
							properties: {
								from: {type: 'string'},
								layout: {type: 'string', enum: LAYOUTS},
								props: {
									type: 'array',
									maxItems: 2,
									items: {
										type: 'object',
										properties: {icon: {type: 'string'}, count: {type: 'integer', minimum: 1, maximum: 9}},
										required: ['icon'],
									},
								},
								label: {type: 'string'},
							},
						},
					},
				},
				required: ['text', 'emotion', 'beats'],
			},
		},
		facts: {
			type: 'array',
			items: {
				type: 'object',
				properties: {claim: {type: 'string'}, evidence: {type: 'string'}},
				required: ['claim', 'evidence'],
			},
		},
		covered: {type: 'boolean', description: 'false nếu NGUỒN không có thông tin trả lời đúng chủ đề'},
		subject: {
			type: 'object',
			description: 'Đối tượng chính của video, lấy từ nguồn',
			properties: {
				name: {type: 'string', description: 'Tên gọi phổ biến (tiếng Việt nếu có)'},
				scientificName: {type: 'string', description: 'Tên khoa học nếu là sinh vật, không có thì để trống'},
				where: {type: 'string', description: 'Sống / xuất hiện ở đâu, ngắn gọn; không có thì để trống'},
			},
			required: ['name'],
		},
	},
	required: ['covered', 'title', 'hook', 'subject', 'lines', 'facts'],
};

const SYSTEM = `Bạn là biên kịch YouTube Shorts tiếng Việt cho kênh "Crab vibe". Người dẫn chuyện là một chú cua dễ thương, lanh lợi (mascot cung Cự Giải), xưng "Cua" hoặc không xưng, gọi người xem là "bạn".

GIỌNG VĂN
- Văn NÓI tự nhiên, câu ngắn, từ ngữ đơn giản cho người xem 13–35 tuổi; hào hứng nhưng không la hét.
- Viết lại bằng lời của mình, KHÔNG chép nguyên câu từ nguồn.
- Tránh: chính trị, tôn giáo, y tế/sức khoẻ có tính khuyên bảo, tài chính, bạo lực, tình dục, người thật còn sống, thương hiệu.

CẤU TRÚC (${LIMITS.minLines}–${LIMITS.maxLines} câu, tổng ${LIMITS.minWords + 10}–${LIMITS.maxWords - 15} chữ, mỗi câu ≤ ${LIMITS.maxLineWords - 8} chữ; "chữ" = 1 âm tiết)
1. Câu 1 = HOOK trong 3 giây: điều bất ngờ nhất, khiến người xem phải ở lại. Không chào hỏi.
2. Giữa: giải thích, chi tiết bất ngờ, mỗi câu 1 ý.
3. Câu áp chót: điểm "wow" hoặc twist.
4. Câu cuối: kêu gọi theo dõi Crab vibe, ngắn, đa dạng cách nói; hình dùng "bell" (chuông) hoặc crab-closeup, KHÔNG dùng icon "crab" (cua mascot đã có sẵn).
- Mỗi câu kết thúc bằng dấu . ! ? — số ghi bằng chữ số được (vd 300 triệu).
- "emotion" của câu: vui | buon | ngacnhien | binhthuong (khớp nội dung; ngacnhien cho điều bất ngờ).

HÌNH ẢNH (beats) — mỗi câu chia 1–3 beat, mỗi beat ~1,5 giây (≥ 4 chữ), là một cảnh riêng. Câu ≥ 8 chữ PHẢI có 2–3 beat:
- "from": cụm 1–3 từ CHÉP Y NGUYÊN từ câu, là chỗ beat bắt đầu. Beat đầu tiên KHÔNG có "from"; mọi beat sau BẮT BUỘC có "from", theo đúng thứ tự trong câu.
- "layout":
  crab-closeup = cua cận mặt phản ứng (KHÔNG có props, hình sẽ bị bỏ) — dùng cho câu hook/cảm xúc;
  crab-presents = cua đứng cạnh đồ vật đang nói tới;
  object-hero = đồ vật to giữa màn hình;
  versus = so sánh 2 thứ (đúng 2 props) — CHỈ khi câu thật sự so sánh/đối lập;
  count = đếm số lượng (1 prop có count 2–9, khớp con số trong câu).
- "props": 1–2 hình minh hoạ đúng thứ đang nói. "icon" PHẢI là một tên trong DANH SÁCH ICON bên dưới (chép y nguyên). Không có icon hợp thì dùng crab-closeup.
- "label": chữ VIẾT HOA to trên màn hình, ≤ 18 ký tự, tóm ý chính/con số của beat. Chỉ ~1/3 số beat có label.
- Đa dạng layout, không lặp 1 layout quá 2 beat liền nhau.

Trả về JSON đúng schema. "title": tiêu đề YouTube hấp dẫn, ≤ 70 ký tự, có thể dùng 1 emoji.`;

const sourceBlock = (sources: Source[]) =>
	sources.length
		? sources.map((s, i) => `--- NGUỒN ${i + 1}: ${s.title} (${s.url}) ---\n${s.text}`).join('\n\n')
		: '(không có nguồn)';

export type Feedback = {draft: Draft; problems: string[]};

export const writeScript = async (
	db: Db,
	{topic, format, sources, feedback}: {topic: string; format: Format; sources: Source[]; feedback?: Feedback},
): Promise<Draft> => {
	let prompt = `${format.writer}

CHỦ ĐỀ: ${topic}

${sourceBlock(sources)}

--- DANH SÁCH ICON (Fluent Emoji) ---
${iconNames().join(', ')}`;
	if (feedback) {
		prompt += `

--- BẢN NHÁP TRƯỚC (bị trả lại) ---
${JSON.stringify({title: feedback.draft.title, subject: feedback.draft.subject, ...feedback.draft.spec, facts: feedback.draft.facts})}

--- LỖI CẦN SỬA ---
${feedback.problems.map((p) => `- ${p}`).join('\n')}

Viết lại kịch bản, sửa HẾT các lỗi trên, giữ những phần tốt.`;
	}
	const out = await generateJson<{covered: boolean; title: string; hook: string; subject?: Subject; lines: VideoSpec['lines']; facts: Fact[]}>(db, {
		system: SYSTEM,
		prompt,
		schema: SCHEMA,
		temperature: feedback ? 0.6 : 0.9,
	});
	const {title, facts, covered, subject, ...spec} = out;
	return {title: title.trim(), facts: facts ?? [], covered: covered !== false, subject: subject ?? {name: ''}, spec};
};

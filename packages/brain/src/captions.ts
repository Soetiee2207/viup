// Caption + hashtag cho từng nền tảng. Model lite (1 lượt/video) gợi ý hashtag theo chủ đề + câu hỏi kéo bình luận,
// code chuẩn hoá (viết liền, không dấu, chữ thường) và ghép theo công thức:
//   TikTok/Facebook: tiêu đề + câu hỏi, rồi 5–6 hashtag = 2–3 theo chủ đề + 2 ngách của định dạng + #xuhuong + #crabvibe
//   YouTube: tiêu đề + #Shorts; mô tả mở bằng câu hỏi, cuối mô tả 3 hashtag đầu (YouTube hiện 3 cái này trên tiêu đề)
// Nhồi nhiều hashtag rộng (#fyp, #viral...) không giúp lên xu hướng; hashtag đúng chủ đề giúp nền tảng hiểu video cho ai.
import type {Db} from '@viup/core';
import {generateJson, models} from './gemini.ts';

const NICHE: Record<string, string[]> = {
	'fun-fact': ['#kienthuc', '#funfact'],
	zodiac: ['#cunghoangdao', '#12cunghoangdao'],
};
const DEFAULT_QUESTION: Record<string, string> = {
	'fun-fact': 'Bạn đã biết điều này chưa? 👇',
	zodiac: 'Bạn cung gì? Tag đứa bạn cung đó vào đây 👇',
};

export const toHashtag = (s: string) => {
	const t = s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'd')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	return t.length >= 3 && t.length <= 24 ? `#${t}` : '';
};

export type Hooks = {hashtags: string[]; question: string};

export const suggestHooks = async (db: Db, opts: {title: string; topic: string; format: string}): Promise<Hooks> => {
	try {
		const out = await generateJson<{hashtags: string[]; question: string}>(db, {
			system: `Bạn làm SEO cho video TikTok / YouTube Shorts tiếng Việt của kênh "Crab vibe" (mascot chú cua, khán giả Việt 13–35 tuổi).`,
			prompt: `Video: "${opts.title}" (chủ đề: ${opts.topic}; định dạng: ${opts.format}).
Cho:
- hashtags: 3 cụm từ tiếng Việt CÓ DẤU, mỗi cụm 1–3 chữ, là thứ người xem gõ tìm khi muốn xem đúng chủ đề này. Cụm đầu = đối tượng chính của video (vd video bạch tuộc: "bạch tuộc", "động vật biển", "sinh vật lạ"; video sấm sét: "sấm sét", "thời tiết", "hiện tượng tự nhiên"; video Cự Giải: "Cự Giải", "cung Cự Giải", "chiêm tinh"). Không dùng từ chung chung như xu hướng, viral, fyp, trending.
- question: 1 câu hỏi ngắn (≤ 60 ký tự) mời người xem bình luận, hợp với video, không lặp lại tiêu đề, không emoji.`,
			schema: {
				type: 'object',
				properties: {
					hashtags: {type: 'array', items: {type: 'string'}},
					question: {type: 'string'},
				},
				required: ['hashtags', 'question'],
			},
			temperature: 0.7,
			models: [...models()].reverse(), // lite là đủ
		});
		return {hashtags: out.hashtags.map(toHashtag).filter(Boolean), question: out.question.replace(/\p{Extended_Pictographic}/gu, '').trim().slice(0, 80)};
	} catch (e) {
		console.warn(`  (không gợi ý được hashtag: ${(e as Error).message.slice(0, 120)} — dùng mặc định)`);
		return {hashtags: [], question: ''};
	}
};

const GENERIC = new Set(['#fyp', '#foryou', '#viral', '#xuhuong', '#trending', '#crabvibe', '#shorts']);

export const captionText = (v: {day: string; topic: string; format: string; title: string; script: string; hooks: Hooks; about?: string}) => {
	const niche = NICHE[v.format] ?? [];
	const topical = [...new Set(v.hooks.hashtags)].filter((t) => !GENERIC.has(t) && !niche.includes(t)).slice(0, 3);
	const q = v.hooks.question.replace(/[\s.]+$/, '');
	const question = q ? `${/[?!]$/.test(q) ? q : `${q}?`} 👇` : DEFAULT_QUESTION[v.format] || '';
	const social = [...topical, ...niche, '#xuhuong', '#crabvibe'].slice(0, 7).join(' ');
	const ytTags = ['#Shorts', ...topical.slice(0, 2), '#crabvibe'].join(' ');
	return `Ngày đăng: ${v.day}
Chủ đề: ${v.topic}
Định dạng: ${v.format}

YouTube (tiêu đề):
${`${v.title} #Shorts`.slice(0, 100)}

TikTok / Facebook (caption):
${v.title} ${question}
${social}

Mô tả YouTube:
${question}
${v.script}
${v.about ? `\n${v.about}\n` : ''}
Crab vibe — video tạo tự động (nội dung có hỗ trợ AI).
${ytTags}

Nhớ bật nhãn "nội dung do AI tạo" khi đăng.
`;
};

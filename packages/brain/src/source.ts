// Lấy văn bản nguồn cho chủ đề từ Wikipedia (miễn phí, không cần key) để AI viết đúng sự thật và QA đối chiếu.
// Bài tiếng Việt + bài tiếng Anh tương ứng (thường chi tiết hơn).
import type {Db} from '@viup/core';
import {generateJson, models} from './gemini.ts';

export type Source = {title: string; url: string; text: string};

const UA = {'user-agent': 'viup/0.1 (https://soetiee2207.github.io/viup/)'};
const MAX_CHARS = {vi: 8_000, en: 16_000};

const api = async (lang: string, params: Record<string, string>) => {
	const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({format: 'json', formatversion: '2', ...params})}`, {
		headers: UA,
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok) throw new Error(`Wikipedia ${lang} lỗi ${res.status}`);
	return res.json();
};

const search = async (lang: string, query: string): Promise<string | null> => {
	const d = await api(lang, {action: 'query', list: 'search', srsearch: query, srlimit: '1'});
	return d.query?.search?.[0]?.title ?? null;
};

// Giữ phần mở đầu + các mục chứa nhiều từ khoá nhất (bài dài như "Flamingo" ~50k ký tự)
const focus = (text: string, keywords: string[], max: number) => {
	if (text.length <= max) return text;
	const sections = text.split(/\n(?===+ )/);
	const kws = keywords.map((k) => k.toLowerCase()).filter((k) => k.length > 2);
	const scored = sections.map((body, i) => ({
		i,
		body,
		score: i === 0 ? Infinity : kws.reduce((n, k) => n + body.toLowerCase().split(k).length - 1, 0) / Math.sqrt(body.length + 200),
	}));
	const keep = new Set<number>();
	let size = 0;
	for (const s of [...scored].sort((a, b) => b.score - a.score)) {
		if (s.score === 0 || size + s.body.length > max) continue;
		keep.add(s.i);
		size += s.body.length;
	}
	if (keep.size === 0) return text.slice(0, max);
	return scored
		.filter((s) => keep.has(s.i))
		.map((s) => s.body)
		.join('\n');
};

const article = async (lang: 'vi' | 'en', title: string, keywords: string[]) => {
	const d = await api(lang, {action: 'query', prop: 'extracts|langlinks', explaintext: '1', redirects: '1', titles: title, lllang: 'en'});
	const page = d.query?.pages?.[0];
	if (!page?.extract) return null;
	const text = page.extract
		// Bỏ các mục không có nội dung hữu ích
		.split(/\n== (?:Xem thêm|Tham khảo|Chú thích|Liên kết ngoài|See also|References|Notes|External links|Further reading) ==[\s\S]*/)[0]
		.replace(/\n{3,}/g, '\n\n');
	return {
		title: page.title as string,
		url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
		text: focus(text, keywords, MAX_CHARS[lang]),
		en: page.langlinks?.[0]?.title as string | undefined,
	};
};

// Tìm thẳng bằng câu chủ đề dễ ra bài sai ("vì sao hồng hạc màu hồng" -> bài "Hồng (màu)"),
// nên nhờ model lite (rẻ) đoán tên bài Wikipedia nói về đối tượng chính trước
const pickTitles = (db: Db, topic: string) =>
	generateJson<{vi: string; en: string; query: string; keywords: string[]}>(db, {
		system: 'Bạn chọn bài Wikipedia phù hợp nhất để tìm hiểu một chủ đề video. Trả về tên bài (đối tượng chính của chủ đề), không phải câu hỏi, một cụm tìm kiếm tiếng Anh cụ thể cho đúng câu hỏi, và 4–8 từ khoá (cả tiếng Việt và tiếng Anh) để tìm đoạn liên quan trong bài.',
		prompt: `Chủ đề: ${topic}\nVí dụ: "vì sao hồng hạc có màu hồng" -> {"vi": "Hồng hạc", "en": "Flamingo", "query": "flamingo pink color diet", "keywords": ["màu hồng", "sắc tố", "thức ăn", "pink", "carotenoid", "diet", "color"]}`,
		schema: {
			type: 'object',
			properties: {vi: {type: 'string'}, en: {type: 'string'}, query: {type: 'string'}, keywords: {type: 'array', items: {type: 'string'}}},
			required: ['vi', 'en', 'query', 'keywords'],
		},
		temperature: 0,
		models: [...models()].reverse(),
	});

export const findSource = async (db: Db, topic: string): Promise<Source[]> => {
	const out: Source[] = [];
	const guess = await pickTitles(db, topic);
	const viTitle = (await search('vi', guess.vi)) ?? (await search('vi', topic));
	const vi = viTitle ? await article('vi', viTitle, guess.keywords) : null;
	if (vi) out.push(vi);
	// Tên AI đoán thường là bài chính ("Flamingo"); liên kết từ bài tiếng Việt có khi trỏ bài hẹp hơn ("Phoenicopterus")
	const enTitle = (await search('en', guess.en)) ?? vi?.en;
	const en = enTitle ? await article('en', enTitle, guess.keywords) : null;
	if (en) out.push(en);
	// Bài chính có khi không nói tới chi tiết được hỏi ("mèo sợ dưa chuột") -> tìm thêm theo cụm cụ thể
	const extraTitle = await search('en', guess.query);
	if (extraTitle && extraTitle !== en?.title) {
		const extra = await article('en', extraTitle, guess.keywords);
		// Chỉ nhận khi bài thật sự nhắc tới ≥ 2 từ khoá (tìm kiếm hay trả bài không liên quan)
		const hits = extra ? guess.keywords.filter((k) => extra.text.toLowerCase().includes(k.toLowerCase())).length : 0;
		if (extra && hits >= 2) out.push({...extra, text: extra.text.slice(0, 8_000)});
	}
	return out.map(({title, url, text}) => ({title, url, text}));
};

export const sourceFromText = (text: string, label: string): Source[] => [{title: label, url: label, text}];

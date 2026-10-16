// Kiểm tra bằng code (không tốn lượt AI) trước khi QA: độ dài, icon có thật, `from` khớp lời thoại, bố cục hợp lệ.
// Lỗi nhỏ tự sửa được (icon sai tên, count vượt giới hạn) thì sửa luôn và ghi vào warnings.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import type {Prop, VideoSpec} from '@viup/video/types';

const require = createRequire(import.meta.url);
const iconSet: {icons: Record<string, unknown>; aliases?: Record<string, {parent: string}>} = JSON.parse(
	readFileSync(require.resolve('@iconify-json/fluent-emoji-flat/icons.json'), 'utf8'),
);
const ICONS = new Set(Object.keys(iconSet.icons));

// Tên icon gửi cho AI: bỏ các biến thể màu da cho gọn prompt
export const iconNames = () => [...ICONS].filter((n) => !/-(light|medium-light|medium|medium-dark|dark)$/.test(n) && !/skin-tone/.test(n));

// Tìm icon gần đúng nhất cho tên AI tự bịa, vd "heart-anatomical" -> "anatomical-heart"
const nearestIcon = (name: string): string | null => {
	const alias = iconSet.aliases?.[name]?.parent;
	if (alias && ICONS.has(alias)) return alias;
	const want = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
	let best: string | null = null;
	let bestScore = 0;
	for (const icon of iconNames()) {
		const parts = icon.split('-');
		const hit = want.filter((w) => parts.includes(w)).length;
		// Ưu tiên khớp nhiều từ, tên ngắn (ít từ thừa)
		const score = hit / want.length - (parts.length - hit) * 0.05;
		if (hit > 0 && score > bestScore) {
			bestScore = score;
			best = icon;
		}
	}
	return bestScore >= 0.5 ? best : null;
};

export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export const words = (s: string) => s.split(/\s+/).filter((w) => norm(w));

// Vị trí cụm từ trong câu (theo từ), giống src/timeline.ts#findPhrase của video
const findPhrase = (text: string[], phrase: string, min: number) => {
	const want = words(phrase).map(norm);
	for (let i = min; i + want.length <= text.length; i++) {
		if (want.length && want.every((w, k) => norm(text[i + k]) === w)) return i;
	}
	return -1;
};

export const LIMITS = {minLines: 4, maxLines: 8, minWords: 80, maxWords: 130, maxLineWords: 30, maxHook: 30, maxLabel: 22};

export type Check = {errors: string[]; warnings: string[]; words: number};

export const validateSpec = (spec: VideoSpec): Check => {
	const errors: string[] = [];
	const warnings: string[] = [];
	const n = spec.lines.length;
	if (n < LIMITS.minLines || n > LIMITS.maxLines) errors.push(`Có ${n} câu, cần ${LIMITS.minLines}–${LIMITS.maxLines} câu`);
	const total = spec.lines.reduce((s, l) => s + words(l.text).length, 0);
	if (total < LIMITS.minWords || total > LIMITS.maxWords)
		errors.push(`Tổng ${total} chữ, cần ${LIMITS.minWords}–${LIMITS.maxWords} chữ (≈ 25–40 giây)`);
	if (spec.hook && spec.hook.length > LIMITS.maxHook) errors.push(`Hook "${spec.hook}" dài quá ${LIMITS.maxHook} ký tự`);

	spec.lines.forEach((line, li) => {
		const at = `Câu ${li + 1}`;
		const text = words(line.text);
		if (text.length > LIMITS.maxLineWords) errors.push(`${at} dài ${text.length} chữ, tối đa ${LIMITS.maxLineWords}`);
		if (!/[.!?…]$/.test(line.text.trim())) line.text = `${line.text.trim()}.`;
		let min = 0;
		(line.beats ?? []).forEach((beat, bi) => {
			const b = `${at}, beat ${bi + 1}`;
			if (beat.from) {
				const pos = findPhrase(text, beat.from, min);
				if (pos < 0) errors.push(`${b}: "from": "${beat.from}" không có trong câu (hoặc sai thứ tự)`);
				else if (bi === 0) delete beat.from; // beat đầu luôn bắt đầu từ đầu câu
				else min = pos + 1;
			}
			if (bi === 0) min = 1;
			if (beat.label && beat.label.length > LIMITS.maxLabel) errors.push(`${b}: nhãn "${beat.label}" dài quá ${LIMITS.maxLabel} ký tự`);
			const props: Prop[] = [];
			for (const p of beat.props ?? []) {
				let icon = p.icon;
				if (!ICONS.has(icon)) {
					const fixed = nearestIcon(icon);
					warnings.push(`${b}: icon "${icon}" không có${fixed ? `, thay bằng "${fixed}"` : ', bỏ đi'}`);
					if (!fixed) continue;
					icon = fixed;
				}
				props.push({...p, icon, count: p.count ? Math.min(9, Math.max(1, Math.round(p.count))) : undefined});
			}
			beat.props = props;
			if (beat.layout === 'versus' && props.length !== 2) errors.push(`${b}: bố cục versus cần đúng 2 hình`);
			if (beat.layout === 'count' && !(props.length === 1 && (props[0].count ?? 1) > 1))
				errors.push(`${b}: bố cục count cần 1 hình có count ≥ 2`);
			if (beat.layout && beat.layout !== 'crab-closeup' && props.length === 0)
				warnings.push(`${b}: bố cục ${beat.layout} không có hình, engine sẽ dùng cua cận mặt`);
		});
		// Tự sửa (không tốn lượt AI viết lại):
		// cua cận mặt không hiện hình -> có hình thì để engine chọn bố cục hiện được hình
		for (const beat of line.beats ?? []) if (beat.layout === 'crab-closeup' && beat.props?.length) delete beat.layout;
		// câu dài chỉ 1 beat -> giao hình + nhãn cho cả câu, engine tự chia 2–3 cảnh (src/timeline.ts#autoBeats)
		if (line.beats?.length === 1 && text.length >= 8 && line.beats[0].props?.length) {
			const [only] = line.beats;
			line.props = only.props;
			if (only.label) line.label = only.label;
			delete line.beats;
			warnings.push(`${at}: chỉ có 1 beat cho ${text.length} chữ, để engine tự chia cảnh`);
		}
		// Beat sau beat đầu phải có from để biết cắt ở đâu; thiếu thì engine tự chia — chấp nhận, chỉ cảnh báo
		if ((line.beats?.length ?? 0) > 1 && line.beats!.slice(1).some((b) => !b.from)) warnings.push(`${at}: có beat thiếu "from", engine tự chia`);
	});
	return {errors, warnings, words: total};
};

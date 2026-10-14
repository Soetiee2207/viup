// Biến manifest (câu + mốc từng từ) thành danh sách cảnh 1–2 giây và các sự kiện SFX.
// Hàm thuần, không phụ thuộc React — scripts/render.ts cũng dùng để chọn khung hình still.
import type {Beat, Bg, Emotion, Layout, Line, Manifest, Prop, Sfx, Transition, Word} from './types';

export type ScenePropItem = Required<Prop>;

export type Scene = {
	index: number;
	from: number; // khung hình bắt đầu (gồm)
	to: number; // khung hình kết thúc (không gồm)
	line: number;
	firstInLine: boolean;
	emotion: Emotion;
	layout: Layout;
	props: ScenePropItem[];
	label: string | null;
	labelAt: number; // khung hình (tính từ đầu cảnh) nhãn đập vào
	bg: Bg;
	transition: Transition;
	// Ai nhép miệng: cua hay đồ vật chính
	speaker: 'crab' | 'object';
	words: Word[];
};

export type SfxEvent = {frame: number; sound: Sfx; volume: number};

export type Timeline = {
	scenes: Scene[];
	sfx: SfxEvent[];
	hookEnd: number; // khung hình kết thúc tiêu đề hook (0 = không có hook)
};

const BEAT_SECONDS = 1.5;
const MAX_BEATS = 3;
// Bắt đầu chuyển cảnh sớm hơn giọng một chút cho cảm giác "bắt nhịp"
const LEAD_SECONDS = 0.12;
const HOOK_SECONDS = 2.2;
const LINE_TRANSITIONS: Transition[] = ['slide', 'spin'];

// Icon có tên chứa các từ này vốn đã có mặt (con vật, người...) -> không gắn mặt thêm
const HAS_FACE = new Set(
	`face person man woman boy girl baby child ghost robot alien skull clown ogre goblin cat dog fish bird octopus crab
	shrimp squid lobster whale dolphin shark turtle frog monkey gorilla bear panda pig cow ox horse mouse rat rabbit fox
	lion tiger wolf chicken rooster chick penguin owl duck snake lizard dragon unicorn koala hamster bee bug ant spider
	snail butterfly seal otter sloth elephant giraffe zebra camel goat ram sheep deer bat hedgehog kangaroo parrot
	peacock flamingo swan eagle dodo t-rex sauropod jellyfish beaver bison mammoth llama hippopotamus rhinoceros orangutan
	poodle badger skunk raccoon boar ewe chipmunk worm cricket mosquito fly beetle cockroach scorpion ladybug`.split(/\s+/),
);

export const hasOwnFace = (icon: string) => icon.split('-').some((part) => HAS_FACE.has(part));

const normProps = (props: Prop[] | undefined): ScenePropItem[] =>
	(props ?? []).map((p) => ({icon: p.icon, count: Math.max(1, p.count ?? 1), face: p.face ?? !hasOwnFace(p.icon)}));

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Vị trí từ đầu tiên của cụm `phrase` trong words, tìm từ vị trí min
const findPhrase = (words: Word[], phrase: string, min: number): number | null => {
	const want = phrase.split(/\s+/).map(norm).filter(Boolean);
	for (let i = min; i + want.length <= words.length; i++) {
		if (want.length && want.every((w, k) => norm(words[i + k].text) === w)) return i;
	}
	return null;
};

// Chia các từ của câu thành n nhóm, ưu tiên cắt sau dấu câu và gần mốc chia đều theo thời gian.
// froms[j]: cụm từ mở đầu nhóm j (nếu có) -> cắt đúng tại đó.
export const splitWords = (words: Word[], n: number, start: number, end: number, froms: (string | undefined)[] = []): Word[][] => {
	n = Math.max(1, Math.min(n, words.length));
	if (n === 1) return [words];
	const cuts: number[] = [];
	for (let j = 1; j < n; j++) {
		const target = start + ((end - start) * j) / n;
		const min = (cuts.at(-1) ?? 0) + 1;
		const max = words.length - (n - j);
		const fixed = froms[j] ? findPhrase(words, froms[j]!, min) : null;
		if (fixed !== null && fixed <= max) {
			cuts.push(fixed);
			continue;
		}
		let best = min;
		let bestCost = Infinity;
		for (let i = min; i <= max; i++) {
			const punct = /[,.!?:;…]$/.test(words[i - 1].text);
			// Khoảng lặng giữa 2 từ = chỗ giọng ngắt nghỉ tự nhiên
			const pause = Math.min(0.3, words[i].start - words[i - 1].end);
			const cost = Math.abs(words[i].start - target) + (punct ? 0 : 0.45) - pause * 2;
			if (cost < bestCost) {
				bestCost = cost;
				best = i;
			}
		}
		cuts.push(best);
	}
	return [0, ...cuts].map((c, j) => words.slice(c, cuts[j] ?? words.length));
};

// Câu không khai báo beats: tự chia theo độ dài và rải hình minh hoạ của câu vào các beat
const autoBeats = (line: Line, isFirst: boolean): Beat[] => {
	const dur = line.end - line.start;
	const k = Math.max(1, Math.min(MAX_BEATS, Math.round(dur / BEAT_SECONDS), line.words.length));
	const props = line.props ?? [];
	const label = line.label ?? undefined;
	if (k === 1) return [{props, label}];
	const beats: Beat[] = [];
	if (isFirst || line.emotion === 'ngacnhien' || props.length === 0) beats.push({layout: 'crab-closeup'});
	// Giới thiệu từng hình một, beat cuối gom tất cả + nhãn
	const intro: Beat[] =
		props.length >= 2 ? props.map((p) => ({props: [p]})) : [{layout: 'crab-presents', props: props.map((p) => ({...p, count: 1}))}];
	for (let i = 0; i < k - beats.length - 1; i++) beats.push(intro[i % intro.length]);
	if (beats.length < k) beats.push({props, label});
	return beats;
};

const layoutFor = (props: ScenePropItem[], variant: number): Layout => {
	if (props.length === 0) return 'crab-closeup';
	if (props.length === 1 && props[0].count > 1) return 'count';
	// 'versus' chỉ dùng khi spec ghi rõ (engine không biết 2 vật có đối lập không)
	return variant % 2 === 0 ? 'object-hero' : 'crab-presents';
};

const bgFor = (emotion: Emotion, layout: Layout, hasLabel: boolean, variant: number): Bg => {
	if (emotion === 'buon') return 'gloom';
	if (emotion === 'ngacnhien') return layout === 'crab-closeup' ? 'speedlines' : 'burst';
	if (emotion === 'vui') return variant % 2 === 0 ? 'burst' : 'bokeh';
	return hasLabel || layout === 'count' ? 'speedlines' : 'bokeh';
};

export const buildTimeline = (manifest: Manifest, durationInFrames: number): Timeline => {
	const {fps} = manifest;
	const f = (s: number) => Math.round(s * fps);
	const scenes: Scene[] = [];
	const sfx: SfxEvent[] = [];
	let lastProps: ScenePropItem[] = [];
	let variant = 0;
	const hookEnd = manifest.hook ? f(HOOK_SECONDS) : 0;

	manifest.lines.forEach((line, li) => {
		const specBeats = line.beats?.length ? line.beats : autoBeats(line, li === 0);
		const groups = splitWords(
			line.words,
			specBeats.length,
			line.words[0]?.start ?? line.start,
			line.words.at(-1)?.end ?? line.end,
			specBeats.map((b) => b.from),
		);
		groups.forEach((words, bi) => {
			const beat = specBeats[bi];
			let props = normProps(beat.props);
			if (props.length === 0 && beat.layout && beat.layout !== 'crab-closeup') props = lastProps;
			if (props.length > 0) lastProps = props;
			let layout = beat.layout ?? layoutFor(props, variant);
			if (layout !== 'crab-closeup' && props.length === 0) layout = 'crab-closeup';
			// Hook: cảnh đầu tiên luôn là cua cận mặt
			if (li === 0 && bi === 0 && manifest.hook && !beat.layout) layout = 'crab-closeup';
			const label = beat.label ?? null;
			const startSec = bi === 0 ? (li === 0 ? 0 : Math.max(line.start - LEAD_SECONDS, manifest.lines[li - 1].end)) : words[0].start;
			const from = f(startSec);
			// Nhãn nằm cùng chỗ với hook -> đợi hook biến mất
			const labelAt = Math.max(LABEL_DELAY, hookEnd - from + 4);
			const transition: Transition =
				beat.transition ??
				(scenes.length === 0
					? 'zoom'
					: bi > 0
						? 'zoom'
						: line.emotion === 'ngacnhien'
							? 'flash'
							: LINE_TRANSITIONS[li % LINE_TRANSITIONS.length]);
			scenes.push({
				index: scenes.length,
				from,
				to: 0,
				line: li,
				firstInLine: bi === 0,
				emotion: line.emotion,
				layout,
				props: layout === 'crab-closeup' ? [] : props,
				label,
				labelAt,
				bg: beat.bg ?? bgFor(line.emotion, layout, label !== null, variant),
				transition,
				speaker: layout === 'crab-closeup' || layout === 'crab-presents' ? 'crab' : 'object',
				words,
			});
			variant++;

			// SFX mở đầu beat
			const auto: Sfx | null =
				transition === 'flash' || (layout === 'crab-closeup' && line.emotion === 'ngacnhien')
					? 'scratch'
					: transition === 'slide' || transition === 'spin'
						? 'whoosh'
						: layout === 'crab-closeup' && bi === 0
							? 'boing'
							: null;
			const first = beat.sfx === 'none' ? null : (beat.sfx ?? auto);
			if (first) sfx.push({frame: from, sound: first, volume: first === 'whoosh' ? 0.35 : 0.5});
			// Đồ vật bật vào -> pop, nhãn hiện -> ding (khớp với hoạt ảnh trong Scene.tsx)
			if (layout === 'count') {
				const n = Math.min(props[0].count, 9);
				for (let i = 0; i < n; i++) sfx.push({frame: from + 4 + i * countStep(n), sound: 'pop', volume: 0.45});
			} else if (layout !== 'crab-closeup') {
				sfx.push({frame: from + 3, sound: 'pop', volume: 0.4});
			}
			if (label) sfx.push({frame: from + labelAt, sound: 'ding', volume: 0.3});
		});
	});

	scenes.forEach((s, i) => {
		s.to = scenes[i + 1]?.from ?? durationInFrames;
	});
	// Bỏ cảnh rỗng (hai beat trùng khung hình)
	const kept = scenes.filter((s) => s.to > s.from);
	kept.forEach((s, i) => (s.index = i));

	return {scenes: kept, sfx: sfx.filter((e) => e.frame < durationInFrames), hookEnd};
};

// Khoảng cách (khung hình) giữa các icon khi đếm, dùng chung với Scene.tsx
export const countStep = (n: number) => (n <= 3 ? 7 : n <= 6 ? 5 : 4);
export const LABEL_DELAY = 8;

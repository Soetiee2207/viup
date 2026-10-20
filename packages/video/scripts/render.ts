// Từ VideoSpec ra MP4 (chạy trong packages/video):
//   node scripts/render.ts [spec.json] [--out out/short.mp4]   -> giọng đọc + icon + SFX + render MP4
//   node scripts/render.ts [spec.json] --stills [--frames 0,45] -> PNG giữa mỗi cảnh + out/stills/sheet.png
//   node scripts/render.ts [spec.json] --voice-only             -> chỉ tạo public/voice.wav + manifest.json
// Tuỳ chọn: --voice vi-VN-HoaiMyNeural --rate +10% --force-voice
// Giọng đọc chỉ tạo lại khi spec (hoặc giọng/tốc độ) đổi.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {buildTimeline} from '../src/timeline.ts';
import type {Manifest} from '../src/types.ts';

const {values, positionals} = parseArgs({
	allowPositionals: true,
	options: {
		out: {type: 'string', default: 'out/short.mp4'},
		stills: {type: 'boolean', default: false},
		frames: {type: 'string'},
		'voice-only': {type: 'boolean', default: false},
		'force-voice': {type: 'boolean', default: false},
		voice: {type: 'string', default: 'vi-VN-NamMinhNeural'},
		rate: {type: 'string', default: '+16%'},
	},
});
const spec = positionals[0] ?? 'spec.json';
const SFX = ['whoosh', 'pop', 'boing', 'ding', 'scratch'];
const DEFAULT_MUSIC = 'music/sunny-reef.mp3';

const run = (cmd: string, args: string[]) => {
	const r = spawnSync(cmd, args, {stdio: 'inherit'});
	if (r.status !== 0) {
		console.error(`Lỗi khi chạy: ${cmd} ${args.join(' ')}`);
		process.exit(r.status ?? 1);
	}
};
const readManifest = (): Manifest & {source?: {sha1: string; voice: string; rate: string}} =>
	JSON.parse(readFileSync('public/manifest.json', 'utf8'));

if (!existsSync(spec)) {
	console.error(`Không thấy ${spec}`);
	process.exit(1);
}

// 1. Giọng đọc + mốc thời gian từng từ
const sha1 = createHash('sha1').update(readFileSync(spec)).digest('hex');
const old = existsSync('public/manifest.json') ? readManifest() : null;
const fresh = old?.source?.sha1 === sha1 && old.source.voice === values.voice && old.source.rate === values.rate;
// Chỉ đổi beat/hình/nhãn (lời thoại giữ nguyên) -> vá manifest, không gọi TTS lại
const patchable = () => {
	if (!old?.source || old.source.voice !== values.voice || old.source.rate !== values.rate || !spec.endsWith('.json')) return false;
	const next = JSON.parse(readFileSync(spec, 'utf8'));
	const same =
		next.lines?.length === old.lines.length &&
		next.lines.every((l: {text: string; speaker?: string}, i: number) => l.text === old.lines[i].text && (l.speaker ?? 'crab') === (old.lines[i].speaker ?? 'crab')) &&
		JSON.stringify(next.guest?.voice ?? null) === JSON.stringify(old.guest?.voice ?? null);
	if (!same) return false;
	const {lines, ...rest} = next;
	const patched = {
		...old,
		hook: rest.hook ?? null,
		music: rest.music ?? null,
		guest: rest.guest ?? null,
		source: {...old.source, sha1},
		lines: old.lines.map((l, i) => ({
			emotion: 'binhthuong',
			...lines[i],
			start: l.start,
			end: l.end,
			words: l.words,
		})),
	};
	writeFileSync('public/manifest.json', JSON.stringify(patched));
	return true;
};
if (fresh && !values['force-voice']) console.log('Giọng đọc đã khớp spec, bỏ qua TTS');
else if (!values['force-voice'] && patchable()) console.log('Lời thoại không đổi, chỉ cập nhật beat/hình trong manifest');
else run('uv', ['run', '../../tools/tts/make_voice.py', spec, '--out', 'public', '--voice', values.voice, `--rate=${values.rate}`]);

// Tiêu đề (chữ trên ảnh bìa) không ảnh hưởng giọng đọc -> chép thẳng vào manifest
{
	const m = readManifest();
	const title = spec.endsWith('.json') ? (JSON.parse(readFileSync(spec, 'utf8')).title ?? null) : null;
	if (m.title !== title) writeFileSync('public/manifest.json', JSON.stringify({...m, title}));
}

// 2. Icon minh hoạ
run('node', ['scripts/icons.ts', 'sync']);
if (values['voice-only']) process.exit(0);

// 3. SFX + nhạc nền (tự tổng hợp nếu chưa có — file âm thanh không nằm trong git)
if (SFX.some((s) => !existsSync(`public/sfx/${s}.mp3`))) run('uv', ['run', '../../tools/music/make_sfx.py', 'public/sfx']);
const manifest = readManifest();
const music = manifest.music ?? DEFAULT_MUSIC;
if (!existsSync(`public/${music}`)) {
	if (music !== DEFAULT_MUSIC) {
		console.error(`Không thấy nhạc nền public/${music}`);
		process.exit(1);
	}
	run('uv', ['run', '../../tools/music/make_loop.py', `public/${music}`, '--seed', '1']);
}

// 4. Render. Khung hình 0 là ảnh bìa (src/Cover.tsx) -> xuất thêm <tên video>.jpg
if (!values.stills) {
	run('npx', ['remotion', 'render', 'Short', values.out]);
	if (manifest.title) run('npx', ['remotion', 'still', 'Short', values.out.replace(/\.mp4$/, '.jpg'), '--frame=0', '--image-format=jpeg']);
	process.exit(0);
}

const {bundle} = await import('@remotion/bundler');
const {renderStill, selectComposition} = await import('@remotion/renderer');
const serveUrl = await bundle({entryPoint: 'src/index.ts'});
const composition = await selectComposition({serveUrl, id: 'Short'});
const {scenes} = buildTimeline(manifest, composition.durationInFrames);
const frames = values.frames
	? values.frames.split(',').map(Number)
	: // Ảnh bìa (khung 0) + mỗi cảnh 1 khung hình sau khi hoạt ảnh vào đã xong
		[...(manifest.title ? [0] : []), ...scenes.map((s) => Math.min(s.to - 1, s.from + Math.max(10, Math.round((s.to - s.from) * 0.6))))];
rmSync('out/stills', {recursive: true, force: true});
mkdirSync('out/stills', {recursive: true});
for (const [k, frame] of frames.entries()) {
	const output = `out/stills/${String(k).padStart(2, '0')}-f${frame}.png`;
	await renderStill({composition, serveUrl, frame, output, inputProps: composition.props});
	const s = scenes.findLast((x) => x.from <= frame);
	console.log(`${output}  ${s ? `cảnh ${s.index}: ${s.layout} / ${s.bg} / "${s.words.map((w) => w.text).join(' ')}"` : ''}`);
}
// Ghép thành 1 ảnh tổng quan (5 cột) để xem nhanh
const cols = Math.min(5, frames.length);
run('ffmpeg', [
	'-v', 'error', '-y', '-pattern_type', 'glob', '-i', 'out/stills/*-f*.png',
	'-vf', `scale=270:480,tile=${cols}x${Math.ceil(frames.length / cols)}:padding=6:color=white`,
	'-frames:v', '1', 'out/stills/sheet.png',
]);
console.log('Ảnh tổng quan: out/stills/sheet.png');

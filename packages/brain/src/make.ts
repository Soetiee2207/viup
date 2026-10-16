// Từ chủ đề ra MP4, không chạm tay:
//   npm run make -- "bạch tuộc có 3 trái tim"                  -> nguồn Wikipedia -> kịch bản -> QA -> giọng -> MP4
//   npm run make -- "3 cung dễ ghen nhất" --format zodiac
//   npm run make -- "chủ đề" --source ghi-chu.txt --no-render   -> tự đưa nguồn, chỉ ra spec.json
//   npm run make -- "chủ đề" --date 2026-10-20                 -> xếp vào ngày đăng cụ thể
//   npm run make -- --usage                                     -> xem đã dùng bao nhiêu lượt Gemini
// Video ra thư mục videos/<ngày đăng>/ kèm file .txt (tiêu đề, caption từng nền tảng).
// Không ghi --date thì tự xếp vào ngày gần nhất (từ hôm nay) còn chưa đủ VIUP_PER_DAY video (mặc định 3).
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {parseArgs} from 'node:util';
import {createDb, findRepoRoot, loadEnv, migrateDb, schema} from '@viup/core';
import {usage} from './gemini.ts';
import {makeScript} from './pipeline.ts';
import {sourceFromText} from './source.ts';

loadEnv();

const {values, positionals} = parseArgs({
	allowPositionals: true,
	options: {
		format: {type: 'string', default: 'fun-fact'},
		source: {type: 'string'},
		'no-render': {type: 'boolean', default: false},
		stills: {type: 'boolean', default: false},
		usage: {type: 'boolean', default: false},
		date: {type: 'string'},
	},
});

const db = createDb();
await migrateDb(db);

if (values.usage) {
	for (const u of await usage(db)) console.log(`${u.model}: ${u.day}/${u.rpd} lượt hôm nay${u.exhausted ? ' (Google báo đã hết)' : ''}, ${u.minute}/${u.rpm} lượt trong 1 phút`);
	process.exit(0);
}

if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
	console.log('--date phải có dạng YYYY-MM-DD, vd 2026-10-20');
	process.exit(1);
}

const topic = positionals.join(' ').trim();
if (!topic) {
	console.log('Cách dùng: npm run make -- "chủ đề" [--format fun-fact|zodiac] [--source nguon.txt] [--no-render] [--stills]');
	process.exit(1);
}

const slug = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/gi, 'd')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40);

const result = await makeScript(db, {
	topic,
	format: values.format,
	sources: values.source ? sourceFromText(readFileSync(values.source, 'utf8'), values.source) : undefined,
});

const root = findRepoRoot();
const videoDir = join(root, 'packages', 'video');
const name = `${result.scriptId}-${slug(topic)}`;
mkdirSync(join(videoDir, 'out', 'specs'), {recursive: true});
const specPath = join(videoDir, 'out', 'specs', `${name}.json`);
writeFileSync(specPath, `${JSON.stringify({...result.draft.spec, title: result.draft.title}, null, 2)}\n`);
console.log(`• Kịch bản: ${relative(root, specPath)}`);

if (!result.pass) {
	const why = result.draft.covered ? `Không qua QA sau ${result.attempts.length} lần viết` : 'Nguồn không đủ thông tin';
	console.error(`✗ ${why} — bỏ chủ đề này (chi tiết: bảng scripts #${result.scriptId} trong DB).`);
	process.exit(2);
}
if (values['no-render']) process.exit(0);

// Ngày theo giờ máy (YYYY-MM-DD); thư mục ngày đăng: videos/2026-10-16/1-chu-de.mp4
const localDate = (d: Date) => d.toLocaleDateString('sv');
const videosDir = join(root, 'videos');
const countOn = (day: string) => (existsSync(join(videosDir, day)) ? readdirSync(join(videosDir, day)).filter((f) => f.endsWith('.mp4')).length : 0);
const pickDay = () => {
	if (values.date) return values.date;
	const perDay = Number(process.env.VIUP_PER_DAY ?? 3);
	const d = new Date();
	while (countOn(localDate(d)) >= perDay) d.setDate(d.getDate() + 1);
	return localDate(d);
};
const day = pickDay();
const dayDir = join(videosDir, day);
const base = `${countOn(day) + 1}-${slug(topic)}`;

console.log('• Render...');
mkdirSync(dayDir, {recursive: true});
const out = join(dayDir, `${base}.mp4`);
const r = spawnSync('node', ['scripts/render.ts', specPath, ...(values.stills ? ['--stills'] : ['--out', out])], {cwd: videoDir, stdio: 'inherit'});
if (r.status !== 0) process.exit(r.status ?? 1);
if (values.stills) {
	console.log(`✓ Xem nhanh: packages/video/out/stills/sheet.png`);
	process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(videoDir, 'public', 'manifest.json'), 'utf8'));
await db.insert(schema.videos).values({scriptId: result.scriptId, path: out, durationSec: manifest.duration});
const {title} = result.draft;
writeFileSync(
	join(dayDir, `${base}.txt`),
	`Ngày đăng: ${day}
Chủ đề: ${topic}

YouTube (tiêu đề):
${title} #Shorts

TikTok / Facebook (caption):
${title} #CrabVibe #fyp #xuhuong

Mô tả YouTube:
${result.draft.spec.lines.map((l) => l.text).join(' ')}

Crab vibe — video tạo tự động (nội dung có hỗ trợ AI).
#Shorts #CrabVibe

Nhớ bật nhãn "nội dung do AI tạo" khi đăng.
`,
);
console.log(`✓ Xong: ${relative(root, out)} (${manifest.duration.toFixed(1)} giây) — đăng ngày ${day}`);
console.log(`  Caption: ${relative(root, join(dayDir, `${base}.txt`))}`);

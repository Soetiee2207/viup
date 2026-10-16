// Từ chủ đề ra MP4, không chạm tay:
//   npm run make -- "bạch tuộc có 3 trái tim"                  -> nguồn Wikipedia -> kịch bản -> QA -> giọng -> MP4
//   npm run make -- "3 cung dễ ghen nhất" --format zodiac
//   npm run make -- "chủ đề" --source ghi-chu.txt --no-render   -> tự đưa nguồn, chỉ ra spec.json
//   npm run make -- "chủ đề" --date 2026-10-20                 -> xếp vào ngày đăng cụ thể
//   npm run make -- --auto [--days 3]                           -> tự chọn chủ đề, làm đủ video cho ngày còn thiếu (Phase 3)
//   npm run make -- --ideas [--discover]                        -> xem (hoặc sinh thêm) kho ý tưởng
//   npm run make -- --usage                                     -> xem đã dùng bao nhiêu lượt Gemini
// Video ra thư mục videos/<ngày đăng>/ kèm file .txt (tiêu đề, caption từng nền tảng).
// Không ghi --date thì tự xếp vào ngày gần nhất (từ hôm nay) còn chưa đủ số video/ngày
// (VIUP_PER_DAY trong .env, không có thì lấy videosPerDay của kênh, mặc định 3).
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {parseArgs} from 'node:util';
import {createDb, ensureDefaultChannel, findRepoRoot, loadEnv, migrateDb, schema} from '@viup/core';
import {FORMATS} from './formats.ts';
import {usage} from './gemini.ts';
import {discoverIdeas, listIdeas, nextIdea, planFormats} from './ideas.ts';
import {makeScript} from './pipeline.ts';
import {sourceFromText, type Source} from './source.ts';

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
		auto: {type: 'boolean', default: false},
		days: {type: 'string', default: '1'},
		ideas: {type: 'boolean', default: false},
		discover: {type: 'boolean', default: false},
	},
});

const db = createDb();
await migrateDb(db);
await ensureDefaultChannel(db);
const [channel] = await db.select().from(schema.channels).limit(1);

if (values.usage) {
	for (const u of await usage(db)) console.log(`${u.model}: ${u.day}/${u.rpd} lượt hôm nay${u.exhausted ? ' (Google báo đã hết)' : ''}, ${u.minute}/${u.rpm} lượt trong 1 phút`);
	process.exit(0);
}

if (values.ideas) {
	if (values.discover) for (const f of Object.keys(FORMATS)) console.log(`• ${f}: thêm ${await discoverIdeas(db, {format: f})} ý tưởng`);
	for (const i of await listIdeas(db)) console.log(`${String(i.id).padStart(4)}  ${i.format.padEnd(8)} ${(i.score ?? 0).toFixed(1).padStart(4)}  ${i.status === 'selected' ? '[đang làm] ' : ''}${i.title}`);
	process.exit(0);
}

if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
	console.log('--date phải có dạng YYYY-MM-DD, vd 2026-10-20');
	process.exit(1);
}

const root = findRepoRoot();
const videoDir = join(root, 'packages', 'video');
const videosDir = join(root, 'videos');
const perDay = Number(process.env.VIUP_PER_DAY ?? channel.videosPerDay ?? 3);

const slug = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/gi, 'd')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40);

// Ngày theo giờ máy (YYYY-MM-DD); thư mục ngày đăng: videos/2026-10-16/1-chu-de.mp4
const localDate = (d: Date) => d.toLocaleDateString('sv');
const countOn = (day: string) => (existsSync(join(videosDir, day)) ? readdirSync(join(videosDir, day)).filter((f) => f.endsWith('.mp4')).length : 0);
const nextOpenDay = () => {
	const d = new Date();
	while (countOn(localDate(d)) >= perDay) d.setDate(d.getDate() + 1);
	return localDate(d);
};

// 1 chủ đề -> kịch bản (QA) -> MP4 trong videos/<day>/. Trả về false nếu chủ đề bị bỏ.
const produce = async (topic: string, format: string, day: string, sources?: Source[]) => {
	let result;
	try {
		result = await makeScript(db, {topic, format, sources});
	} catch (e) {
		console.error(`✗ ${(e as Error).message}`);
		return false;
	}
	const name = `${result.scriptId}-${slug(topic)}`;
	mkdirSync(join(videoDir, 'out', 'specs'), {recursive: true});
	const specPath = join(videoDir, 'out', 'specs', `${name}.json`);
	writeFileSync(specPath, `${JSON.stringify({...result.draft.spec, title: result.draft.title}, null, 2)}\n`);
	console.log(`• Kịch bản: ${relative(root, specPath)}`);
	if (!result.pass) {
		const why = result.draft.covered ? `Không qua QA sau ${result.attempts.length} lần viết` : 'Nguồn không đủ thông tin';
		console.error(`✗ ${why} — bỏ chủ đề này (chi tiết: bảng scripts #${result.scriptId} trong DB).`);
		return false;
	}
	if (values['no-render']) return true;

	const dayDir = join(videosDir, day);
	const base = `${countOn(day) + 1}-${slug(topic)}`;
	const out = join(dayDir, `${base}.mp4`);
	console.log('• Render...');
	mkdirSync(dayDir, {recursive: true});
	const r = spawnSync('node', ['scripts/render.ts', specPath, ...(values.stills ? ['--stills'] : ['--out', out])], {cwd: videoDir, stdio: 'inherit'});
	if (r.status !== 0) throw new Error(`Render lỗi (mã ${r.status})`);
	if (values.stills) {
		console.log(`✓ Xem nhanh: packages/video/out/stills/sheet.png`);
		return true;
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
	return true;
};

if (values.auto) {
	// Mỗi ô trống thử tối đa 4 ý tưởng (fun-fact có thể bị bỏ vì Wikipedia không có nguồn)
	let made = 0;
	for (let n = 0; n < Number(values.days); n++) {
		const day = nextOpenDay();
		const missing = perDay - countOn(day);
		const plan = planFormats(channel.formats, missing);
		console.log(`\n=== Ngày ${day}: cần thêm ${missing} video (${Object.entries(plan).map(([f, k]) => `${f} ×${k}`).join(', ')}) ===`);
		for (const [format, k] of Object.entries(plan)) {
			for (let slot = 0; slot < k; slot++) {
				let ok = false;
				for (let tries = 0; tries < 4 && !ok; tries++) {
					const idea = await nextIdea(db, format);
					if (!idea) break;
					console.log(`\n--- [${format}] ${idea.title} (điểm ${idea.score?.toFixed(1)}) ---`);
					ok = await produce(idea.title, format, day);
				}
				if (ok) made++;
				else console.error(`✗ Không làm được video ${format} cho ngày ${day}`);
			}
		}
		if (countOn(day) < perDay) break; // thiếu (thường do hết hạn mức) -> dừng, lần sau chạy tiếp
	}
	console.log(`\nĐã làm ${made} video. Hạn mức Gemini:`);
	for (const u of await usage(db)) console.log(`  ${u.model}: ${u.day}/${u.rpd} lượt hôm nay`);
	process.exit(made ? 0 : 2);
}

const topic = positionals.join(' ').trim();
if (!topic) {
	console.log('Cách dùng: npm run make -- "chủ đề" [--format fun-fact|zodiac] [--date YYYY-MM-DD] [--source nguon.txt] [--no-render] [--stills]');
	console.log('           npm run make -- --auto [--days N]   |   npm run make -- --ideas [--discover]   |   npm run make -- --usage');
	process.exit(1);
}
const ok = await produce(
	topic,
	values.format,
	values.date ?? nextOpenDay(),
	values.source ? sourceFromText(readFileSync(values.source, 'utf8'), values.source) : undefined,
);
process.exit(ok ? 0 : 2);

// Công cụ icon minh hoạ (Fluent Emoji Flat, MIT):
//   node scripts/icons.ts search heart     -> tìm tên icon
//   node scripts/icons.ts sync             -> trích icon mà public/manifest.json dùng ra public/icons/*.svg
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

type IconSet = {icons: Record<string, {body: string; width?: number; height?: number}>; width: number; height: number};

const require = createRequire(import.meta.url);
const set: IconSet = JSON.parse(readFileSync(require.resolve('@iconify-json/fluent-emoji-flat/icons.json'), 'utf8'));

const toSvg = (name: string) => {
	const icon = set.icons[name];
	const w = icon.width ?? set.width;
	const h = icon.height ?? set.height;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`;
};

const [command, ...args] = process.argv.slice(2);

if (command === 'search') {
	const words = args.map((a) => a.toLowerCase());
	const hits = Object.keys(set.icons).filter((n) => words.every((w) => n.includes(w)));
	console.log(hits.length ? hits.join('\n') : 'Không tìm thấy icon nào');
} else if (command === 'sync') {
	const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
	type Props = {icon: string}[] | undefined;
	const used = new Set<string>(
		manifest.lines.flatMap((l: {props?: Props; beats?: {props?: Props}[]}) =>
			[l.props, ...(l.beats ?? []).map((b) => b.props)].flatMap((ps) => (ps ?? []).map((p) => p.icon)),
		),
	);
	// Nhân vật khách (cảnh đối thoại + ảnh bìa) có thể không nằm trong props của câu nào
	if (manifest.guest?.icon) used.add(manifest.guest.icon);
	const missing = [...used].filter((n) => !set.icons[n]);
	if (missing.length) {
		console.error(`Icon không tồn tại: ${missing.join(', ')} — tìm tên đúng bằng: node scripts/icons.ts search <từ khoá>`);
		process.exit(1);
	}
	mkdirSync('public/icons', {recursive: true});
	for (const name of used) writeFileSync(`public/icons/${name}.svg`, toSvg(name));
	console.log(`Đã trích ${used.size} icon -> public/icons/`);
} else {
	console.log('Lệnh: search <từ khoá> | sync');
	process.exitCode = 1;
}

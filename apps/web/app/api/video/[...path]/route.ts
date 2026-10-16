// Phát video trong videos/ cho trình xem (hỗ trợ Range để tua)
import {createReadStream, existsSync, statSync} from 'node:fs';
import {Readable} from 'node:stream';
import {safeVideoPath} from '@/lib/viup';

export async function GET(request: Request, {params}: {params: Promise<{path: string[]}>}) {
	const {path} = await params;
	let file: string;
	try {
		file = safeVideoPath(...path);
	} catch {
		return new Response('Không hợp lệ', {status: 400});
	}
	if (!file.endsWith('.mp4') || !existsSync(file)) return new Response('Không có', {status: 404});
	const size = statSync(file).size;
	const range = request.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
	const headers: Record<string, string> = {'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'};
	if (!range) {
		return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {headers: {...headers, 'Content-Length': String(size)}});
	}
	const start = range[1] ? Number(range[1]) : 0;
	const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
	return new Response(Readable.toWeb(createReadStream(file, {start, end})) as ReadableStream, {
		status: 206,
		headers: {...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1)},
	});
}

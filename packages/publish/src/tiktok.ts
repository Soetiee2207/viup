// TikTok Content Posting API, chế độ "upload to drafts": video vào hộp thư/nháp trong app TikTok,
// người dùng tự mở app thêm caption rồi đăng (không cần quyền video.publish, dễ được duyệt).
import {spawn} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {secretsPath, type StatItem} from '@viup/core';

const SCOPES = ['user.info.basic', 'video.upload', 'video.list']; // video.list: lấy lượt xem cho trang Thống kê
// Phải trùng y nguyên Redirect URI (tab Desktop) đã khai trong TikTok developer portal
const PORT = 8723;
const REDIRECT_URI = `http://localhost:${PORT}/callback/`;
const API = 'https://open.tiktokapis.com';
const CLIENT_FILE = () => secretsPath('tiktok_client.json');
const TOKEN_FILE = () => secretsPath('tiktok_token.json');

type Client = {client_key: string; client_secret: string};
type Token = {access_token: string; refresh_token: string; expires_at: number; refresh_expires_at: number; open_id: string};

const loadClient = (): Client => {
	const file = CLIENT_FILE();
	if (!existsSync(file)) {
		writeFileSync(file, `${JSON.stringify({client_key: 'DAN_CLIENT_KEY_VAO_DAY', client_secret: 'DAN_CLIENT_SECRET_VAO_DAY'}, null, 2)}\n`, {mode: 0o600});
		throw new Error(`Đã tạo ${file} — mở file, dán Client key + Client secret (bản Sandbox) rồi chạy lại`);
	}
	const c: Client = JSON.parse(readFileSync(file, 'utf8'));
	if (!c.client_key || c.client_key.startsWith('DAN_')) throw new Error(`Chưa điền Client key/secret trong ${file}`);
	return c;
};

const saveToken = (t: Token) => writeFileSync(TOKEN_FILE(), JSON.stringify(t, null, 2), {mode: 0o600});

const requestToken = async (params: Record<string, string>): Promise<Token> => {
	const c = loadClient();
	const res = await fetch(`${API}/v2/oauth/token/`, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: new URLSearchParams({client_key: c.client_key, client_secret: c.client_secret, ...params}),
	});
	const b = await res.json();
	if (!res.ok || b.error) throw new Error(`TikTok OAuth lỗi ${res.status}: ${b.error_description ?? JSON.stringify(b)}`);
	return {
		access_token: b.access_token,
		refresh_token: b.refresh_token,
		expires_at: Date.now() + b.expires_in * 1000,
		refresh_expires_at: Date.now() + b.refresh_expires_in * 1000,
		open_id: b.open_id,
	};
};

// Đăng nhập 1 lần trên trình duyệt; TikTok desktop dùng PKCE với code_challenge = SHA256 dạng hex
export const tiktokAuth = async () => {
	const client = loadClient();
	const verifier = randomBytes(32).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('hex');
	const state = randomBytes(16).toString('hex');

	const code = await new Promise<string>((resolve, reject) => {
		const servers = ['127.0.0.1', '::1'].map(() =>
			createServer((req, res) => {
				const url = new URL(req.url ?? '/', REDIRECT_URI);
				if (!url.pathname.startsWith('/callback')) return res.writeHead(404).end();
				const error = url.searchParams.get('error');
				const got = url.searchParams.get('code');
				const ok = !error && got && url.searchParams.get('state') === state;
				res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
				res.end(ok ? '<h2>viup: đăng nhập TikTok thành công, có thể đóng tab này.</h2>' : `<h2>Lỗi: ${error ?? 'state không khớp'}</h2>`);
				for (const s of servers) s.close();
				ok ? resolve(got) : reject(new Error(`Đăng nhập thất bại: ${url.searchParams.get('error_description') ?? error ?? 'state không khớp'}`));
			}),
		);
		// "localhost" có thể là IPv4 hoặc IPv6 tuỳ trình duyệt -> nghe cả hai
		servers.forEach((s, i) => s.on('error', () => {}).listen(PORT, i ? '::1' : '127.0.0.1'));
		const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
			client_key: client.client_key,
			scope: SCOPES.join(','),
			response_type: 'code',
			redirect_uri: REDIRECT_URI,
			state,
			code_challenge: challenge,
			code_challenge_method: 'S256',
		})}`;
		console.log(`\nMở link sau, đăng nhập bằng tài khoản TikTok của kênh (phải nằm trong Target users của Sandbox):\n\n${authUrl}\n`);
		spawn('xdg-open', [authUrl], {stdio: 'ignore', detached: true}).on('error', () => {}).unref();
	});

	const t = await requestToken({grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier});
	saveToken(t);
	const me = await tiktokApi(t.access_token, 'GET', '/v2/user/info/?fields=open_id,display_name');
	console.log(`Đã kết nối TikTok: ${me.user?.display_name ?? t.open_id} — token lưu ở ${TOKEN_FILE()}`);
};

const accessToken = async () => {
	if (!existsSync(TOKEN_FILE())) throw new Error('Chưa đăng nhập TikTok — chạy: npm run tt:auth');
	const token: Token = JSON.parse(readFileSync(TOKEN_FILE(), 'utf8'));
	if (token.expires_at - 60_000 > Date.now()) return token.access_token;
	if (token.refresh_expires_at < Date.now()) throw new Error('Phiên TikTok hết hạn (1 năm) — chạy lại: npm run tt:auth');
	const t = await requestToken({grant_type: 'refresh_token', refresh_token: token.refresh_token});
	saveToken(t);
	return t.access_token;
};

const tiktokApi = async (token: string, method: 'GET' | 'POST', path: string, body?: unknown) => {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8'},
		body: body ? JSON.stringify(body) : undefined,
	});
	const b = await res.json();
	if (!res.ok || (b.error?.code && b.error.code !== 'ok')) throw new Error(`TikTok ${path} lỗi ${res.status}: ${b.error?.code} ${b.error?.message ?? ''}`);
	return b.data;
};

// Quy tắc chia phần của TikTok: mỗi phần 5–64MB, phần cuối gộp phần dư; file ≤ 64MB gửi 1 lần
const MB = 1024 * 1024;
const plan = (size: number) => {
	if (size <= 64 * MB) return {chunk: size, count: 1};
	const chunk = 10 * MB;
	return {chunk, count: Math.floor(size / chunk)};
};

export const tiktokUpload = async (file: string) => {
	const token = await accessToken();
	const me = await tiktokApi(token, 'GET', '/v2/user/info/?fields=open_id,display_name');
	console.log(`Tài khoản nhận: ${me.user?.display_name}`);
	const size = statSync(file).size;
	const {chunk, count} = plan(size);
	const init = await tiktokApi(token, 'POST', '/v2/post/publish/inbox/video/init/', {
		source_info: {source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count},
	});
	const fd = openSync(file, 'r');
	try {
		for (let i = 0; i < count; i++) {
			const start = i * chunk;
			const end = i === count - 1 ? size - 1 : start + chunk - 1;
			const buf = Buffer.alloc(end - start + 1);
			readSync(fd, buf, 0, buf.length, start);
			const res = await fetch(init.upload_url, {
				method: 'PUT',
				headers: {'Content-Type': 'video/mp4', 'Content-Length': String(buf.length), 'Content-Range': `bytes ${start}-${end}/${size}`},
				body: buf,
			});
			if (!res.ok) throw new Error(`TikTok upload phần ${i + 1}/${count} lỗi ${res.status}: ${await res.text()}`);
		}
	} finally {
		closeSync(fd);
	}
	// Chờ TikTok xử lý xong và gửi vào hộp thư của tài khoản
	for (let i = 0; i < 40; i++) {
		const s = await tiktokApi(token, 'POST', '/v2/post/publish/status/fetch/', {publish_id: init.publish_id});
		console.log(`  trạng thái TikTok: ${s.status}`);
		if (s.status === 'FAILED') throw new Error(`TikTok xử lý video thất bại: ${s.fail_reason}`);
		if (s.status === 'SEND_TO_USER_INBOX' || s.status === 'PUBLISH_COMPLETE') return {publishId: init.publish_id as string, status: s.status as string};
		await new Promise((r) => setTimeout(r, 3000));
	}
	return {publishId: init.publish_id as string, status: 'PROCESSING_UPLOAD'};
};

// Số liệu các video đã đăng công khai trên tài khoản (cần quyền video.list: bật trong TikTok developer rồi chạy lại npm run tt:auth)
export const tiktokStats = async (): Promise<StatItem[]> => {
	const token = await accessToken();
	const fields = 'id,title,video_description,create_time,share_url,view_count,like_count,comment_count,share_count';
	const items: StatItem[] = [];
	let cursor: number | undefined;
	for (let page = 0; page < 10; page++) {
		const d = await tiktokApi(token, 'POST', `/v2/video/list/?fields=${fields}`, {max_count: 20, ...(cursor ? {cursor} : {})});
		for (const v of d.videos ?? [])
			items.push({
				platform: 'tiktok',
				id: v.id,
				title: v.title || v.video_description || '(không tiêu đề)',
				url: v.share_url,
				publishedAt: new Date(v.create_time * 1000).toISOString(),
				views: v.view_count ?? 0,
				likes: v.like_count ?? 0,
				comments: v.comment_count ?? 0,
				shares: v.share_count ?? 0,
			});
		if (!d.has_more) break;
		cursor = d.cursor;
	}
	return items;
};

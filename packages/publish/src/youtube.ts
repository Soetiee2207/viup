import {spawn} from 'node:child_process';
import {randomBytes, createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync, writeFileSync, createReadStream} from 'node:fs';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {secretsPath, type StatItem} from '@viup/core';

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
const CLIENT_FILE = () => secretsPath('youtube_client.json');
const TOKEN_FILE = () => secretsPath('youtube_token.json');

type Client = {client_id: string; client_secret: string; auth_uri: string; token_uri: string};
type Token = {access_token: string; refresh_token: string; expires_at: number};

const loadClient = (): Client => {
	if (!existsSync(CLIENT_FILE())) throw new Error(`Thiếu ${CLIENT_FILE()} — xem docs/SETUP_APIS.md mục 2A`);
	const json = JSON.parse(readFileSync(CLIENT_FILE(), 'utf8'));
	return json.installed ?? json.web;
};

const saveToken = (token: Token) => writeFileSync(TOKEN_FILE(), JSON.stringify(token, null, 2), {mode: 0o600});

const requestToken = async (client: Client, params: Record<string, string>) => {
	const res = await fetch(client.token_uri, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: new URLSearchParams({client_id: client.client_id, client_secret: client.client_secret, ...params}),
	});
	const body = await res.json();
	if (!res.ok) throw new Error(`Google OAuth lỗi ${res.status}: ${JSON.stringify(body)}`);
	return body as {access_token: string; refresh_token?: string; expires_in: number};
};

// Đăng nhập 1 lần trên trình duyệt (loopback + PKCE), lưu refresh token vào secrets/
export const youtubeAuth = async () => {
	const client = loadClient();
	const verifier = randomBytes(32).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	const state = randomBytes(16).toString('hex');

	const code = await new Promise<{code: string; redirectUri: string}>((resolve, reject) => {
		const server = createServer((req, res) => {
			const url = new URL(req.url ?? '/', 'http://127.0.0.1');
			if (url.pathname !== '/') return res.writeHead(404).end();
			const error = url.searchParams.get('error');
			const got = url.searchParams.get('code');
			const ok = !error && got && url.searchParams.get('state') === state;
			res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
			res.end(ok ? '<h2>viup: đăng nhập YouTube thành công, có thể đóng tab này.</h2>' : `<h2>Lỗi: ${error ?? 'state không khớp'}</h2>`);
			server.close();
			ok ? resolve({code: got, redirectUri}) : reject(new Error(`Đăng nhập thất bại: ${error ?? 'state không khớp'}`));
		});
		let redirectUri = '';
		server.listen(0, '127.0.0.1', () => {
			const {port} = server.address() as {port: number};
			redirectUri = `http://127.0.0.1:${port}/`;
			const authUrl = new URL(client.auth_uri);
			authUrl.search = new URLSearchParams({
				client_id: client.client_id,
				redirect_uri: redirectUri,
				response_type: 'code',
				scope: SCOPES.join(' '),
				access_type: 'offline',
				prompt: 'consent',
				state,
				code_challenge: challenge,
				code_challenge_method: 'S256',
			}).toString();
			console.log(`\nMở link sau để đăng nhập bằng tài khoản của kênh:\n\n${authUrl}\n`);
			spawn('xdg-open', [authUrl.toString()], {stdio: 'ignore', detached: true}).on('error', () => {}).unref();
		});
	});

	const t = await requestToken(client, {
		grant_type: 'authorization_code',
		code: code.code,
		redirect_uri: code.redirectUri,
		code_verifier: verifier,
	});
	if (!t.refresh_token) throw new Error('Google không trả refresh_token — thử lại (đã đặt prompt=consent)');
	saveToken({access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000});
	console.log(`Đã lưu token vào ${TOKEN_FILE()}`);
};

const accessToken = async () => {
	if (!existsSync(TOKEN_FILE())) throw new Error('Chưa đăng nhập YouTube — chạy: npm run yt:auth');
	const token: Token = JSON.parse(readFileSync(TOKEN_FILE(), 'utf8'));
	if (token.expires_at - 60_000 > Date.now()) return token.access_token;
	const t = await requestToken(loadClient(), {grant_type: 'refresh_token', refresh_token: token.refresh_token});
	saveToken({...token, access_token: t.access_token, expires_at: Date.now() + t.expires_in * 1000});
	return t.access_token;
};

export type YoutubeUpload = {
	file: string;
	title: string;
	description: string;
	tags?: string[];
	privacy?: 'private' | 'unlisted' | 'public';
};

// Upload kiểu resumable. Lưu ý: project chưa qua audit thì YouTube luôn ép video về private
export const youtubeUpload = async (video: YoutubeUpload) => {
	const token = await accessToken();
	const size = statSync(video.file).size;
	const meta = {
		snippet: {
			title: video.title.slice(0, 100),
			description: video.description.slice(0, 5000),
			tags: video.tags,
			categoryId: '27', // Education
			defaultLanguage: 'vi',
		},
		status: {
			privacyStatus: video.privacy ?? 'private',
			selfDeclaredMadeForKids: false,
			containsSyntheticMedia: true, // gắn nhãn nội dung tạo bằng AI
		},
	};
	// Đôi khi Google treo ~60s rồi trả 409 "already exists" (yêu cầu bị gửi lặp phía Google, để lại 1 video rỗng kẹt
	// "đang xử lý") -> mở phiên upload mới, tối đa 3 lần
	let location: string | null = null;
	for (let attempt = 1; !location; attempt++) {
		const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json; charset=UTF-8',
				'X-Upload-Content-Type': 'video/mp4',
				'X-Upload-Content-Length': String(size),
			},
			body: JSON.stringify(meta),
		});
		location = init.ok ? init.headers.get('location') : null;
		if (!location && (init.status !== 409 || attempt >= 3)) throw new Error(`YouTube khởi tạo upload lỗi ${init.status}: ${await init.text()}`);
	}

	const res = await fetch(location, {
		method: 'PUT',
		headers: {'Content-Type': 'video/mp4', 'Content-Length': String(size)},
		body: Readable.toWeb(createReadStream(video.file)) as ReadableStream,
		duplex: 'half',
	} as RequestInit);
	const body = await res.json();
	if (!res.ok) throw new Error(`YouTube upload lỗi ${res.status}: ${JSON.stringify(body)}`);
	return {id: body.id as string, url: `https://youtube.com/shorts/${body.id}`, privacy: body.status?.privacyStatus as string};
};

// Số liệu mọi video trên kênh (cả video đăng tay), tốn ~3 đơn vị hạn mức/50 video
export const youtubeStats = async (): Promise<StatItem[]> => {
	const token = await accessToken();
	const get = async (path: string) => {
		const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {headers: {Authorization: `Bearer ${token}`}});
		const b = await res.json();
		if (!res.ok) throw new Error(`YouTube ${path.split('?')[0]} lỗi ${res.status}: ${b.error?.message ?? ''}`);
		return b;
	};
	const ch = await get('channels?part=contentDetails&mine=true');
	const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
	if (!uploads) return [];
	const ids: string[] = [];
	let pageToken = '';
	for (let page = 0; page < 10; page++) {
		const p = await get(`playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${pageToken ? `&pageToken=${pageToken}` : ''}`);
		ids.push(...p.items.map((i: {contentDetails: {videoId: string}}) => i.contentDetails.videoId));
		if (!p.nextPageToken) break;
		pageToken = p.nextPageToken;
	}
	const items: StatItem[] = [];
	for (let i = 0; i < ids.length; i += 50) {
		const v = await get(`videos?part=snippet,statistics,status&id=${ids.slice(i, i + 50).join(',')}`);
		for (const x of v.items)
			items.push({
				platform: 'youtube',
				id: x.id,
				title: x.snippet.title,
				url: `https://youtube.com/shorts/${x.id}`,
				publishedAt: x.snippet.publishedAt,
				privacy: x.status.privacyStatus,
				views: Number(x.statistics.viewCount ?? 0),
				likes: Number(x.statistics.likeCount ?? 0),
				comments: Number(x.statistics.commentCount ?? 0),
			});
	}
	return items;
};

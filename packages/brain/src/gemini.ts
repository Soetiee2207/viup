// Gọi Gemini API (free tier) trả JSON theo schema, kèm bộ đếm hạn mức trong DB (bảng api_calls).
// Gần chạm giới hạn/phút -> tự chờ; chạm giới hạn/ngày -> chuyển model dự phòng, hết cả thì báo lỗi.
// Hạn mức ngày của Google reset lúc 0h giờ Thái Bình Dương (14–15h giờ VN).
// Chỉnh qua .env: GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_RPM, GEMINI_RPD, GEMINI_FALLBACK_RPD
import {and, eq, gte, inArray, like, sql} from 'drizzle-orm';
import {requireEnv, schema, type Db} from '@viup/core';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const SERVICE = 'gemini';
const MINUTE = 60_000;
// Lỗi 429 do hết lượt/ngày được ghi với tiền tố này để lần chạy sau bỏ qua model luôn
const DAY_QUOTA = '[hết lượt/ngày]';

export const models = () => [
	process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
	process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-flash-lite-latest',
];
// Free tier (10/2026): gemini-3.8-flash 20 lượt/ngày; bản lite nhiều hơn. Lỗi 429 thật vẫn được xử lý nếu số này sai.
const limits = (model: string) => {
	const main = model === models()[0];
	return {
		rpm: Number(process.env.GEMINI_RPM ?? 8),
		rpd: Number((main ? process.env.GEMINI_RPD : process.env.GEMINI_FALLBACK_RPD) ?? (main ? 20 : 200)),
	};
};

// 0h hôm nay theo giờ Thái Bình Dương (mốc reset hạn mức ngày của Google)
const dayStart = () => {
	const now = new Date();
	const pt = new Date(now.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));
	const offset = now.getTime() - pt.getTime();
	pt.setHours(0, 0, 0, 0);
	return pt.getTime() + offset;
};

export class QuotaError extends Error {}

// Model đã biết là hết lượt trong lần chạy này -> bỏ qua im lặng
const skipped = new Set<string>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chỉ tính lượt thành công/đang chạy — lượt lỗi không bị Google trừ hạn mức
const countSince = async (db: Db, model: string, since: number) => {
	const [row] = await db
		.select({n: sql<number>`count(*)`, first: sql<number | null>`min(${schema.apiCalls.createdAt})`})
		.from(schema.apiCalls)
		.where(
			and(
				eq(schema.apiCalls.service, SERVICE),
				eq(schema.apiCalls.model, model),
				inArray(schema.apiCalls.status, ['pending', 'ok']),
				gte(schema.apiCalls.createdAt, new Date(since)),
			),
		);
	return {n: Number(row.n), first: row.first === null ? null : Number(row.first)};
};

const dayExhausted = async (db: Db, model: string) => {
	const [row] = await db
		.select({n: sql<number>`count(*)`})
		.from(schema.apiCalls)
		.where(
			and(
				eq(schema.apiCalls.service, SERVICE),
				eq(schema.apiCalls.model, model),
				like(schema.apiCalls.error, `${DAY_QUOTA}%`),
				gte(schema.apiCalls.createdAt, new Date(dayStart())),
			),
		);
	return Number(row.n) > 0;
};

// Giữ chỗ 1 lượt gọi: chờ nếu đủ lượt/phút, ném QuotaError nếu hết lượt/ngày
const acquire = async (db: Db, model: string) => {
	const {rpm, rpd} = limits(model);
	if (await dayExhausted(db, model)) throw new QuotaError(`${model}: Google báo hết lượt hôm nay`);
	if ((await countSince(db, model, dayStart())).n >= rpd) throw new QuotaError(`${model}: đã dùng ${rpd}/${rpd} lượt hôm nay`);
	while (true) {
		const minute = await countSince(db, model, Date.now() - MINUTE);
		if (minute.n < rpm) break;
		const wait = (minute.first ?? Date.now()) + MINUTE - Date.now() + 500;
		console.log(`  [gemini] đủ ${rpm} lượt/phút, chờ ${Math.ceil(wait / 1000)}s`);
		await sleep(Math.max(wait, 1000));
	}
	const [row] = await db.insert(schema.apiCalls).values({service: SERVICE, model}).returning({id: schema.apiCalls.id});
	return row.id;
};

export type UsageReport = {model: string; minute: number; day: number; exhausted: boolean; rpm: number; rpd: number}[];

export const usage = async (db: Db): Promise<UsageReport> =>
	Promise.all(
		models().map(async (model) => ({
			model,
			minute: (await countSince(db, model, Date.now() - MINUTE)).n,
			day: (await countSince(db, model, dayStart())).n,
			exhausted: await dayExhausted(db, model),
			...limits(model),
		})),
	);

type Request = {
	system: string;
	prompt: string;
	schema: object;
	temperature?: number;
	// Thứ tự model thử (mặc định: chính rồi dự phòng)
	models?: string[];
};

// Lỗi tạm thời (quá tải, vượt hạn mức phút) -> thử lại; lỗi khác -> dừng
const RETRY = new Set([429, 500, 502, 503, 504]);

export const generateJson = async <T>(db: Db, req: Request): Promise<T> => {
	const key = requireEnv('GEMINI_API_KEY').trim();
	let lastError: unknown;
	for (const model of req.models ?? models()) {
		if (skipped.has(model)) continue;
		for (let attempt = 0; attempt < 4; attempt++) {
			let id: number;
			try {
				id = await acquire(db, model);
			} catch (e) {
				lastError = e;
				if (e instanceof QuotaError) skipped.add(model);
				break; // hết lượt/ngày -> sang model dự phòng
			}
			const done = (values: Partial<typeof schema.apiCalls.$inferInsert>) =>
				db.update(schema.apiCalls).set(values).where(eq(schema.apiCalls.id, id));
			let status = 0;
			try {
				const res = await fetch(`${API}/${model}:generateContent`, {
					method: 'POST',
					headers: {'x-goog-api-key': key, 'content-type': 'application/json'},
					signal: AbortSignal.timeout(180_000),
					body: JSON.stringify({
						systemInstruction: {parts: [{text: req.system}]},
						contents: [{role: 'user', parts: [{text: req.prompt}]}],
						generationConfig: {
							responseMimeType: 'application/json',
							responseJsonSchema: req.schema,
							temperature: req.temperature ?? 0.7,
						},
					}),
				});
				status = res.status;
				const body = await res.json();
				if (!res.ok) {
					type Detail = {retryDelay?: string; violations?: {quotaId?: string}[]};
					const details: Detail[] = body.error?.details ?? [];
					const retryInfo = details.find((d) => d.retryDelay)?.retryDelay;
					const perDay = details.some((d) => d.violations?.some((v) => v.quotaId?.includes('PerDay')));
					const err = new Error(`${perDay ? `${DAY_QUOTA} ` : ''}Gemini ${model} lỗi ${res.status}: ${body.error?.message ?? ''}`.slice(0, 300));
					await done({status: 'error', error: err.message});
					lastError = err;
					if (!RETRY.has(res.status)) throw err;
					if (perDay) {
						skipped.add(model);
						break;
					}
					// Model quá tải -> sang model dự phòng sớm thay vì chờ lâu
					if (res.status === 503 && attempt >= 1) break;
					const wait = retryInfo ? parseFloat(retryInfo) * 1000 + 500 : 2000 * 2 ** attempt;
					console.log(`  [gemini] ${model} lỗi ${res.status}, thử lại sau ${Math.ceil(wait / 1000)}s`);
					await sleep(Math.min(wait, 60_000));
					continue;
				}
				const text: string = body.candidates?.[0]?.content?.parts?.map((p: {text?: string}) => p.text ?? '').join('') ?? '';
				await done({status: 'ok', tokens: body.usageMetadata?.totalTokenCount ?? null});
				try {
					return JSON.parse(text) as T;
				} catch {
					lastError = new Error(`Gemini ${model} trả JSON hỏng (finishReason ${body.candidates?.[0]?.finishReason})`);
					continue;
				}
			} catch (e) {
				if (status && !RETRY.has(status)) throw e;
				if (!status) {
					// Lỗi mạng / quá thời gian
					await done({status: 'error', error: String(e).slice(0, 300)});
					lastError = e;
					await sleep(2000 * 2 ** attempt);
				}
			}
		}
		console.log(`  [gemini] ${skipped.has(model) ? `${model} hết lượt hôm nay` : `bỏ ${model}`}, chuyển model dự phòng`);
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

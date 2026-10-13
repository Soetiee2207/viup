import {index, integer, real, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core';

const id = () => integer('id').primaryKey({autoIncrement: true});
const createdAt = () =>
	integer('created_at', {mode: 'timestamp_ms'})
		.notNull()
		.$defaultFn(() => new Date());

// Tỉ lệ các định dạng nội dung của kênh, vd {"fun-fact": 0.6, "zodiac": 0.4}
export type FormatWeights = Record<string, number>;

export const channels = sqliteTable('channels', {
	id: id(),
	name: text('name').notNull(),
	language: text('language').notNull().default('vi'),
	formats: text('formats', {mode: 'json'}).$type<FormatWeights>().notNull(),
	character: text('character').notNull(),
	voice: text('voice').notNull(),
	// Biểu thức cron, vd "0 11,19 * * *" = 11h và 19h mỗi ngày
	schedule: text('schedule').notNull(),
	videosPerDay: integer('videos_per_day').notNull().default(1),
	active: integer('active', {mode: 'boolean'}).notNull().default(true),
	createdAt: createdAt(),
});

export const ideas = sqliteTable(
	'ideas',
	{
		id: id(),
		channelId: integer('channel_id')
			.notNull()
			.references(() => channels.id),
		format: text('format').notNull(),
		title: text('title').notNull(),
		summary: text('summary').notNull(),
		sourceUrl: text('source_url'),
		sourceText: text('source_text'),
		// Dấu vân tay để chống trùng chủ đề
		fingerprint: text('fingerprint').notNull(),
		score: real('score'),
		status: text('status', {enum: ['new', 'selected', 'rejected', 'used']})
			.notNull()
			.default('new'),
		createdAt: createdAt(),
	},
	(t) => [uniqueIndex('ideas_channel_fingerprint').on(t.channelId, t.fingerprint)],
);

export const scripts = sqliteTable('scripts', {
	id: id(),
	ideaId: integer('idea_id')
		.notNull()
		.references(() => ideas.id),
	// VideoSpec — hợp đồng giữa brain và video (định nghĩa ở Phase 1)
	spec: text('spec', {mode: 'json'}).notNull(),
	qaReport: text('qa_report', {mode: 'json'}),
	status: text('status', {enum: ['draft', 'passed', 'failed']})
		.notNull()
		.default('draft'),
	attempts: integer('attempts').notNull().default(0),
	createdAt: createdAt(),
});

export const videos = sqliteTable('videos', {
	id: id(),
	scriptId: integer('script_id')
		.notNull()
		.references(() => scripts.id),
	path: text('path').notNull(),
	durationSec: real('duration_sec').notNull(),
	createdAt: createdAt(),
});

export const posts = sqliteTable('posts', {
	id: id(),
	videoId: integer('video_id')
		.notNull()
		.references(() => videos.id),
	platform: text('platform', {enum: ['youtube', 'facebook', 'tiktok']}).notNull(),
	externalId: text('external_id'),
	url: text('url'),
	status: text('status', {enum: ['scheduled', 'posted', 'failed']})
		.notNull()
		.default('scheduled'),
	scheduledAt: integer('scheduled_at', {mode: 'timestamp_ms'}).notNull(),
	postedAt: integer('posted_at', {mode: 'timestamp_ms'}),
	error: text('error'),
	createdAt: createdAt(),
});

export const metrics = sqliteTable('metrics', {
	id: id(),
	postId: integer('post_id')
		.notNull()
		.references(() => posts.id),
	views: integer('views').notNull().default(0),
	likes: integer('likes').notNull().default(0),
	comments: integer('comments').notNull().default(0),
	avgViewPercent: real('avg_view_percent'),
	collectedAt: createdAt(),
});

export const jobs = sqliteTable(
	'jobs',
	{
		id: id(),
		type: text('type').notNull(),
		payload: text('payload', {mode: 'json'}).$type<Record<string, unknown>>().notNull(),
		status: text('status', {enum: ['queued', 'running', 'done', 'failed']})
			.notNull()
			.default('queued'),
		attempts: integer('attempts').notNull().default(0),
		maxAttempts: integer('max_attempts').notNull().default(3),
		runAfter: integer('run_after', {mode: 'timestamp_ms'})
			.notNull()
			.$defaultFn(() => new Date()),
		lockedAt: integer('locked_at', {mode: 'timestamp_ms'}),
		error: text('error'),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', {mode: 'timestamp_ms'})
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index('jobs_status_run_after').on(t.status, t.runAfter)],
);

export type Channel = typeof channels.$inferSelect;
export type Job = typeof jobs.$inferSelect;

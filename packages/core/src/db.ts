import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@libsql/client';
import {drizzle} from 'drizzle-orm/libsql';
import {migrate} from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.ts';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

// Thư mục gốc monorepo (nơi package.json có "workspaces"), để web và worker dùng chung data/
export const findRepoRoot = (from = process.cwd()): string => {
	let dir = from;
	while (true) {
		const pkg = join(dir, 'package.json');
		if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).workspaces) return dir;
		const parent = dirname(dir);
		if (parent === dir) throw new Error(`Không tìm thấy thư mục gốc viup từ ${from}`);
		dir = parent;
	}
};

export const dbPath = () => process.env.VIUP_DB_PATH ?? join(findRepoRoot(), 'data', 'viup.db');

export const createDb = (path = dbPath()): Db => {
	mkdirSync(dirname(path), {recursive: true});
	const client = createClient({url: `file:${path}`});
	return drizzle(client, {schema});
};

const migrationsFolder = () => {
	// Chạy từ source (worker) -> cạnh file này; bị bundle (Next.js) -> tìm theo repo root
	try {
		const local = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
		if (existsSync(local)) return local;
	} catch {}
	return join(findRepoRoot(), 'packages', 'core', 'migrations');
};

export const migrateDb = async (db: Db) => {
	await db.run('PRAGMA journal_mode = WAL');
	await migrate(db, {migrationsFolder: migrationsFolder()});
};

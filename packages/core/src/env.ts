import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {findRepoRoot} from './db.ts';

// Nạp .env ở thư mục gốc (nếu có) vào process.env, không ghi đè biến đã đặt sẵn
export const loadEnv = () => {
	const path = join(findRepoRoot(), '.env');
	if (existsSync(path)) process.loadEnvFile(path);
};

export const requireEnv = (name: string) => {
	const value = process.env[name];
	if (!value) throw new Error(`Thiếu biến môi trường ${name} — thêm vào file .env ở thư mục gốc`);
	return value;
};

// Thư mục chứa OAuth client/token (gitignored, không bao giờ commit)
export const secretsPath = (...parts: string[]) => join(findRepoRoot(), 'secrets', ...parts);

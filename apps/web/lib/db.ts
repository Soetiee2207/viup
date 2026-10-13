import {createDb, migrateDb, type Db} from '@viup/core';

// Một kết nối dùng chung cho cả tiến trình (tránh mở lại khi hot reload)
const g = globalThis as unknown as {viupDb?: Db; viupReady?: Promise<void>};
const db = (g.viupDb ??= createDb());
const ready = (g.viupReady ??= migrateDb(db));

export const getDb = async () => {
	await ready;
	return db;
};

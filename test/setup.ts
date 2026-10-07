import { afterAll } from 'bun:test';
import { SQL } from 'bun';

// Тесты работают с отдельной базой shop_test: она создаётся заново
// при каждом запуске по текущим миграциям и не трогает данные магазина.
const mainDatabaseUrl =
	Bun.env.DATABASE_URL ?? 'postgres://shop:shop@localhost:5433/shop';
const testDatabaseUrl = new URL(mainDatabaseUrl);
testDatabaseUrl.pathname = '/shop_test';

const mainSql = new SQL(mainDatabaseUrl);
try {
	await mainSql`DROP DATABASE IF EXISTS shop_test WITH (FORCE)`;
} catch (error) {
	throw new Error(
		'Нет подключения к PostgreSQL. Запустите базу: docker compose up -d db',
		{ cause: error },
	);
}
await mainSql`CREATE DATABASE shop_test`;
await mainSql.close();

Bun.env.DATABASE_URL = testDatabaseUrl.href;

const { applyMigrations } = await import('~/migrations.ts');
const { startServer } = await import('~/app.ts');

await applyMigrations();

// Один сервер на все тесты, его адрес берут функции из helpers.ts.
const server = startServer(0);
Bun.env.TEST_APP_URL = server.url.origin;
afterAll(() => server.stop(true));

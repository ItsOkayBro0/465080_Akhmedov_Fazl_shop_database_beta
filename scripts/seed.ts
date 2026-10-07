import { sql } from '~/db.ts';
import { applyMigrations } from '~/migrations.ts';

await applyMigrations({ until: '001_init.sql' });

const seeded = await sql`
	SELECT 1 FROM users WHERE email = 'anna@example.com'
`;

if (seeded.length > 0) {
	console.log('Данные уже загружены');
} else {
	console.log('Загружаем данные, при первом запуске это 1–2 минуты…');
	const startedAt = performance.now();

	await sql.begin(async (transaction) => {
		await transaction.file(`${import.meta.dir}/../db/seed.sql`);
	});
	await sql`VACUUM ANALYZE`;

	const seconds = ((performance.now() - startedAt) / 1000).toFixed(0);
	console.log(`Данные загружены за ${seconds} с`);
}

await sql.close();

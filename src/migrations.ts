import { Glob } from 'bun';
import { sql } from '~/db.ts';

const migrationsDirectory = `${import.meta.dir}/../db/migrations`;

// Каждый файл из db/migrations применяется один раз, по порядку имён и в отдельной транзакции.
// until — имя последнего файла, который нужно применить.
export async function applyMigrations({ until }: { until?: string } = {}) {
	await sql`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`;

	const appliedMigrations = await sql<{ name: string }[]>`
		SELECT name FROM schema_migrations
	`;
	const appliedNames = new Set(appliedMigrations.map(({ name }) => name));

	const migrationFiles = [
		...new Glob('*.sql').scanSync(migrationsDirectory),
	].sort();

	for (const migrationFile of migrationFiles) {
		if (!appliedNames.has(migrationFile)) {
			await sql.begin(async (transaction) => {
				await transaction.file(`${migrationsDirectory}/${migrationFile}`);
				await transaction`INSERT INTO schema_migrations (name) VALUES (${migrationFile})`;
			});
			console.log(`Миграция применена: ${migrationFile}`);
		}

		if (migrationFile === until) {
			break;
		}
	}
}

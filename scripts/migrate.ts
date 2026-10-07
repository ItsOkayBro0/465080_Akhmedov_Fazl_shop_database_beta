import { sql } from '~/db.ts';
import { applyMigrations } from '~/migrations.ts';

await applyMigrations();

console.log('Схема базы актуальна');
await sql.close();

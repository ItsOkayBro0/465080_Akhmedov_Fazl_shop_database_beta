import { SQL } from 'bun';
import { environment } from '~/env.ts';

export const sql = new SQL(environment.DATABASE_URL);

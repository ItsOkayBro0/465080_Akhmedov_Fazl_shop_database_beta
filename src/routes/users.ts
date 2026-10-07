import { sql } from '~/db.ts';
import { json, type User } from '~/http.ts';

export async function list() {
	const users = await sql<User[]>`
		SELECT id, email, name
		FROM users
		ORDER BY id
		LIMIT 5
	`;

	return json(users);
}

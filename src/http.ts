import type { BunRequest } from 'bun';
import * as v from 'valibot';
import { sql } from '~/db.ts';
import { IdSchema } from '~/schemas.ts';
import type { UserRow } from '~/tables.ts';

export type User = Pick<UserRow, 'id' | 'email' | 'name'>;

export function json(responseData: unknown, statusCode = 200) {
	return Response.json(responseData, { status: statusCode });
}

// Интерфейс передаёт выбранного покупателя в заголовке
export async function getUser(request: BunRequest) {
	const userIdResult = v.safeParse(
		IdSchema,
		Number(request.headers.get('x-user-id')),
	);

	if (!userIdResult.success) {
		return null;
	}

	const matchingUsers = await sql<User[]>`
		SELECT id, email, name
		FROM users
		WHERE id = ${userIdResult.output}
	`;

	return matchingUsers[0] ?? null;
}

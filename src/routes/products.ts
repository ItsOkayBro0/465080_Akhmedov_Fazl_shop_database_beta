import type { BunRequest } from 'bun';
import { sql } from '~/db.ts';
import { json } from '~/http.ts';
import type { ProductRow } from '~/tables.ts';

export async function list(request: BunRequest) {
	const searchText =
		new URL(request.url).searchParams.get('q')?.trim().slice(0, 100) ?? '';

	const products = await sql<ProductRow[]>`
		SELECT id, title, price, stock
		FROM products
		WHERE title ILIKE ${`%${searchText}%`}
		ORDER BY id
		LIMIT 24
	`;

	return json(products);
}

import { sql } from '~/db.ts';

export const appUrl = Bun.env.TEST_APP_URL as string;

export async function createUser() {
	const [user] = await sql<{ id: number; email: string }[]>`
		INSERT INTO users (email, name)
		VALUES (${`user-${crypto.randomUUID()}@example.com`}, 'Тестовый покупатель')
		RETURNING id, email
	`;
	return user;
}

export async function createProduct({ price = 1000, stock = 10 } = {}) {
	const [product] = await sql<{ id: number; title: string }[]>`
		INSERT INTO products (title, price, stock)
		VALUES (${`Товар ${crypto.randomUUID()}`}, ${price}, ${stock})
		RETURNING id, title
	`;
	return product;
}

export async function getStock(productId: number) {
	const [product] = await sql<{ stock: number }[]>`
		SELECT stock FROM products WHERE id = ${productId}
	`;
	return product.stock;
}

export function placeOrder(
	userId: number,
	items: { productId: number; quantity: number }[],
	idempotencyKey?: string,
) {
	return fetch(`${appUrl}/api/orders`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-user-id': String(userId),
			...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
		},
		body: JSON.stringify({ items }),
	});
}

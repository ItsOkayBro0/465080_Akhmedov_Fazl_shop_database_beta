import type { BunRequest } from 'bun';
import * as v from 'valibot';
import { sql } from '~/db.ts';
import { getUser, json } from '~/http.ts';
import { CheckoutSchema, IdempotencyKeySchema, PageSchema } from '~/schemas.ts';
import type { OrderItemRow, OrderRow, ProductRow } from '~/tables.ts';

type OrderLine = Pick<OrderItemRow, 'product_id' | 'quantity' | 'price'> &
	Pick<ProductRow, 'title'>;

const PAGE_SIZE = 50;

function getTotal(lines: Pick<OrderLine, 'quantity' | 'price'>[]) {
	return lines.reduce((total, line) => total + line.price * line.quantity, 0);
}

export async function list(request: BunRequest) {
	const user = await getUser(request);
	if (!user) {
		return json({ error: 'Выберите покупателя' }, 401);
	}

	const pageResult = v.safeParse(
		PageSchema,
		new URL(request.url).searchParams.get('page') ?? '1',
	);
	if (!pageResult.success) {
		return json({ error: 'Некорректный номер страницы' }, 400);
	}
	const page = pageResult.output;

	const [summary] = await sql<{ orders_count: number; total_spent: number }[]>`
		SELECT
			count(DISTINCT orders.id)::int AS orders_count,
			coalesce(sum(order_items.price * order_items.quantity), 0)::float8 AS total_spent
		FROM orders
		JOIN order_items ON order_items.order_id = orders.id
		WHERE orders.user_id = ${user.id}
	`;

	const pageOrders = await sql<
		Pick<OrderRow, 'id' | 'status' | 'created_at'>[]
	>`
		SELECT id, status, created_at
		FROM orders
		WHERE user_id = ${user.id}
		ORDER BY created_at DESC
		LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
	`;

	const ordersWithItems = [];
	for (const order of pageOrders) {
		const orderLines = await sql<OrderLine[]>`
			SELECT order_items.product_id, products.title, order_items.quantity, order_items.price
			FROM order_items
			JOIN products ON products.id = order_items.product_id
			WHERE order_items.order_id = ${order.id}
			ORDER BY order_items.id
		`;

		ordersWithItems.push({
			...order,
			items: orderLines,
			total: getTotal(orderLines),
		});
	}

	return json({
		page,
		pages: Math.max(1, Math.ceil(summary.orders_count / PAGE_SIZE)),
		orders_count: summary.orders_count,
		total_spent: summary.total_spent,
		orders: ordersWithItems,
	});
}

export async function create(request: BunRequest) {
	const user = await getUser(request);
	if (!user) {
		return json({ error: 'Выберите покупателя' }, 401);
	}

	// Клиент повторяет запрос с тем же ключом, если не дождался ответа.
	const idempotencyKey = request.headers.get('idempotency-key');
	if (idempotencyKey !== null && !v.is(IdempotencyKeySchema, idempotencyKey)) {
		return json({ error: 'Idempotency-Key должен быть UUID' }, 400);
	}

	const validationResult = v.safeParse(CheckoutSchema, await request.text());
	if (!validationResult.success) {
		return json({ error: 'Проверьте состав заказа' }, 400);
	}

	if (idempotencyKey !== null) {
		const existingOrders = await sql<{ id: number; total: number }[]>`
			SELECT orders.id, coalesce(sum(order_items.price * order_items.quantity), 0)::int AS total
			FROM orders
			LEFT JOIN order_items ON order_items.order_id = orders.id
			WHERE orders.user_id = ${user.id} AND orders.idempotency_key = ${idempotencyKey}
			GROUP BY orders.id
		`;
		if (existingOrders[0]) {
			return json(existingOrders[0]);
		}
	}

	const purchases: { product: ProductRow; quantity: number }[] = [];
	for (const { productId, quantity } of validationResult.output.items) {
		const matchingProducts = await sql<ProductRow[]>`
			SELECT id, title, price, stock
			FROM products
			WHERE id = ${productId}
		`;

		const product = matchingProducts[0];
		if (!product) {
			return json({ error: 'Товар не найден' }, 404);
		}

		if (product.stock < quantity) {
			return json({ error: `Недостаточно товара «${product.title}»` }, 409);
		}

		purchases.push({ product, quantity });
	}

	const createdOrders = await sql<Pick<OrderRow, 'id'>[]>`
		INSERT INTO orders (user_id, idempotency_key)
		VALUES (${user.id}, ${idempotencyKey})
		RETURNING id
	`;
	const orderId = createdOrders[0].id;

	for (const { product, quantity } of purchases) {
		await sql`
			INSERT INTO order_items (order_id, product_id, quantity, price)
			VALUES (${orderId}, ${product.id}, ${quantity}, ${product.price})
		`;
		await sql`
			UPDATE products SET stock = ${product.stock - quantity}
			WHERE id = ${product.id}
		`;
	}

	const total = getTotal(
		purchases.map(({ product, quantity }) => ({
			quantity,
			price: product.price,
		})),
	);

	return json({ id: orderId, total }, 201);
}

// Одновременные заказы: последний ноутбук и повтор одного запроса
// Приложение должно работать на APP_URL!!!!
import { sql } from '~/db.ts';

const appUrl = Bun.env.APP_URL ?? 'http://localhost:3000';
const REQUESTS = 10;

function placeOrder(
	userId: number,
	productId: number,
	idempotencyKey?: string,
) {
	return fetch(`${appUrl}/api/orders`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-user-id': String(userId),
			...(idempotencyKey && { 'idempotency-key': idempotencyKey }),
		},
		body: JSON.stringify({ items: [{ productId, quantity: 1 }] }),
	});
}

function countStatuses(responses: Response[]) {
	return Object.entries(Object.groupBy(responses, ({ status }) => status))
		.map(([status, group = []]) => `${status} × ${group.length}`)
		.join(', ');
}

async function getProduct(title: string) {
	const [product] = await sql<{ id: number; stock: number }[]>`
		SELECT id, stock FROM products WHERE title = ${title}
	`;
	return product;
}

const laptop = await getProduct('Ноутбук');
await sql`UPDATE products SET stock = 1 WHERE id = ${laptop.id}`;
const [{ lastOrderId }] = await sql<{ lastOrderId: number }[]>`
	SELECT coalesce(max(id), 0) AS "lastOrderId" FROM orders
`;

const laptopResponses = await Promise.all(
	Array.from({ length: REQUESTS }, (_, index) =>
		placeOrder(index + 1, laptop.id),
	),
);
const [{ sold }] = await sql<{ sold: number }[]>`
	SELECT coalesce(sum(quantity), 0)::int AS sold
	FROM order_items
	WHERE product_id = ${laptop.id} AND order_id > ${lastOrderId}
`;
const laptopStock = (await getProduct('Ноутбук')).stock;
const isStockCorrect = sold === 1 && laptopStock === 0;

console.log(
	`Последний ноутбук: ${REQUESTS} одновременных покупок при остатке 1`,
);
console.log(`  ответы: ${countStatuses(laptopResponses)}`);
console.log(
	`  продано ${sold}, осталось ${laptopStock}: ${isStockCorrect ? 'OK' : 'ошибка, продан должен быть ровно один'}`,
);

const mouse = await getProduct('Мышь');
await sql`UPDATE products SET stock = 50 WHERE id = ${mouse.id}`;
const idempotencyKey = crypto.randomUUID();

const retryResponses = await Promise.all(
	Array.from({ length: REQUESTS }, () =>
		placeOrder(1, mouse.id, idempotencyKey),
	),
);
const [{ orders }] = await sql<{ orders: number }[]>`
	SELECT count(*)::int AS orders FROM orders
	WHERE idempotency_key = ${idempotencyKey}
`;
const mouseStock = (await getProduct('Мышь')).stock;
const isRetryCorrect = orders === 1 && mouseStock === 49;

console.log(
	`Повтор запроса: ${REQUESTS} одновременных запросов с одним Idempotency-Key`,
);
console.log(`  ответы: ${countStatuses(retryResponses)}`);
console.log(
	`  создано заказов ${orders}, списано мышек ${50 - mouseStock}: ${isRetryCorrect ? 'OK' : 'ошибка, заказ должен быть один'}`,
);

await sql.close();
process.exit(isStockCorrect && isRetryCorrect ? 0 : 1);

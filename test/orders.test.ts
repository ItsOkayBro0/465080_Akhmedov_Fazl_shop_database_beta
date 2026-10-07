import { describe, expect, it } from 'bun:test';
import {
	appUrl,
	createProduct,
	createUser,
	getStock,
	placeOrder,
} from './helpers.ts';

async function getOrders(userId: number, page = 1) {
	const ordersResponse = await fetch(`${appUrl}/api/orders?page=${page}`, {
		headers: { 'x-user-id': String(userId) },
	});
	expect(ordersResponse.status).toBe(200);
	return ordersResponse.json();
}

describe('заказы', () => {
	it('оформляет заказ, списывает остаток и показывает заказ в истории', async () => {
		const user = await createUser();
		const mouse = await createProduct({ price: 990, stock: 5 });
		const keyboard = await createProduct({ price: 2990, stock: 3 });

		const orderResponse = await placeOrder(user.id, [
			{ productId: mouse.id, quantity: 2 },
			{ productId: keyboard.id, quantity: 1 },
		]);
		expect(orderResponse.status).toBe(201);
		const createdOrder = await orderResponse.json();
		expect(createdOrder.total).toBe(4970);

		expect(await getStock(mouse.id)).toBe(3);
		expect(await getStock(keyboard.id)).toBe(2);

		const history = await getOrders(user.id);
		expect(history).toMatchObject({
			page: 1,
			pages: 1,
			orders_count: 1,
			total_spent: 4970,
		});
		const [latestOrder] = history.orders;
		expect(latestOrder.id).toBe(createdOrder.id);
		expect(latestOrder.total).toBe(4970);
		expect(latestOrder.items).toEqual([
			{ product_id: mouse.id, title: mouse.title, quantity: 2, price: 990 },
			{
				product_id: keyboard.id,
				title: keyboard.title,
				quantity: 1,
				price: 2990,
			},
		]);
	});

	it('не оформляет заказ, если товара не хватает', async () => {
		const user = await createUser();
		const monitor = await createProduct({ stock: 1 });

		const orderResponse = await placeOrder(user.id, [
			{ productId: monitor.id, quantity: 2 },
		]);

		expect(orderResponse.status).toBe(409);
		expect(await getStock(monitor.id)).toBe(1);
		expect((await getOrders(user.id)).orders_count).toBe(0);
	});

	it('сообщает, что товара нет в каталоге', async () => {
		const user = await createUser();

		const orderResponse = await placeOrder(user.id, [
			{ productId: 2_000_000_000, quantity: 1 },
		]);

		expect(orderResponse.status).toBe(404);
		expect((await getOrders(user.id)).orders_count).toBe(0);
	});

	it('показывает итоги за всё время и пустую страницу за последней', async () => {
		const user = await createUser();
		const cable = await createProduct({ price: 500, stock: 10 });
		for (const quantity of [1, 2]) {
			await placeOrder(user.id, [{ productId: cable.id, quantity }]);
		}

		const history = await getOrders(user.id);
		expect(history).toMatchObject({
			pages: 1,
			orders_count: 2,
			total_spent: 1500,
		});
		expect(
			history.orders.map((order: { total: number }) => order.total),
		).toEqual([1000, 500]);
		expect((await getOrders(user.id, 2)).orders).toEqual([]);
	});

	it('не принимает повторяющиеся товары в одном заказе', async () => {
		const user = await createUser();
		const cable = await createProduct();

		const orderResponse = await placeOrder(user.id, [
			{ productId: cable.id, quantity: 1 },
			{ productId: cable.id, quantity: 1 },
		]);

		expect(orderResponse.status).toBe(400);
	});

	it('не показывает и не оформляет заказы без покупателя', async () => {
		const ordersResponse = await fetch(`${appUrl}/api/orders`);
		expect(ordersResponse.status).toBe(401);

		const orderResponse = await fetch(`${appUrl}/api/orders`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }] }),
		});
		expect(orderResponse.status).toBe(401);
	});
});

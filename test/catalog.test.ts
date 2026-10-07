import { describe, expect, it } from 'bun:test';
import { appUrl, createProduct } from './helpers.ts';

describe('каталог', () => {
	it('находит товар по части названия', async () => {
		const product = await createProduct({ price: 1990, stock: 7 });

		const searchResponse = await fetch(
			`${appUrl}/api/products?q=${encodeURIComponent(product.title.slice(6, 20))}`,
		);
		expect(searchResponse.status).toBe(200);

		const foundProducts = await searchResponse.json();
		expect(foundProducts).toContainEqual({
			id: product.id,
			title: product.title,
			price: 1990,
			stock: 7,
		});
	});
});

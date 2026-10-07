import { json } from '~/http.ts';
import * as orderRoutes from '~/routes/orders.ts';
import * as productRoutes from '~/routes/products.ts';
import * as userRoutes from '~/routes/users.ts';
import homepage from '../public/index.html';

export function startServer(port: number) {
	return Bun.serve({
		port,
		routes: {
			'/': homepage,

			'/api/users': {
				GET: () => userRoutes.list(),
			},
			'/api/products': {
				GET: (request) => productRoutes.list(request),
			},
			'/api/orders': {
				GET: (request) => orderRoutes.list(request),
				POST: (request) => orderRoutes.create(request),
			},
		},
		fetch() {
			return new Response('Not found', { status: 404 });
		},
		error(error) {
			console.error(error);
			return json({ error: 'Внутренняя ошибка сервера' }, 500);
		},
	});
}

interface User {
	id: number;
	name: string;
}

interface Product {
	id: number;
	title: string;
	price: number;
	stock: number;
}

interface Order {
	id: number;
	status: 'new' | 'paid' | 'shipped' | 'cancelled';
	created_at: string;
	total: number;
	items: { title: string; quantity: number; price: number }[];
}

interface OrderPage {
	page: number;
	pages: number;
	orders_count: number;
	total_spent: number;
	orders: Order[];
}

type View = 'catalog' | 'orders';
type PageTarget = 'first' | 'previous' | 'next' | 'last';

const statusBadges: Record<Order['status'], [string, string]> = {
	new: ['Новый', 'badge-info'],
	paid: ['Оплачен', 'badge-success'],
	shipped: ['Отправлен', 'badge-primary'],
	cancelled: ['Отменён', 'badge-error'],
};

const rubles = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
	maximumFractionDigits: 0,
});
const dates = new Intl.DateTimeFormat('ru-RU', {
	dateStyle: 'medium',
	timeStyle: 'short',
});
const seconds = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const counts = new Intl.NumberFormat('ru-RU');

const cart = new Map<number, { product: Product; quantity: number }>();
let currentUserId = Number(localStorage.getItem('shop:user'));

// Повторная отправка той же корзины идёт с тем же ключом
let checkoutKey = crypto.randomUUID();
let ordersPage = 1;
let ordersPages = 1;

function byId<T extends HTMLElement = HTMLElement>(id: string) {
	return document.getElementById(id) as T;
}

function fromTemplate(templateId: string) {
	const template = byId<HTMLTemplateElement>(templateId);
	return template.content.firstElementChild?.cloneNode(true) as HTMLElement;
}

function field<T extends HTMLElement = HTMLElement>(
	root: Element,
	name: string,
) {
	return root.querySelector(`[data-field="${name}"]`) as T;
}

function formatDuration(milliseconds: number) {
	return milliseconds < 1000
		? `${Math.round(milliseconds)} мс`
		: `${seconds.format(milliseconds / 1000)} с`;
}

function showToast(message: string, kind: 'success' | 'error') {
	const alert = document.createElement('div');
	alert.className =
		kind === 'success' ? 'alert alert-success' : 'alert alert-error';
	alert.textContent = message;
	byId('toasts').append(alert);
	setTimeout(() => alert.remove(), 5000);
}

function showError(error: unknown) {
	showToast(error instanceof Error ? error.message : String(error), 'error');
}

async function api<T>(
	path: string,
	init: Omit<RequestInit, 'headers'> & {
		headers?: Record<string, string>;
	} = {},
) {
	const response = await fetch(path, {
		...init,
		headers: {
			'content-type': 'application/json',
			'x-user-id': String(currentUserId),
			...init.headers,
		},
	});
	const responseBody = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(responseBody.error ?? `Ошибка ${response.status}`);
	}
	return responseBody as T;
}

async function loadUsers() {
	const users = await api<User[]>('/api/users');
	if (!users.some((user) => user.id === currentUserId)) {
		currentUserId = users[0]?.id ?? 0;
	}

	const userSelect = byId<HTMLSelectElement>('user-select');
	userSelect.replaceChildren(
		...users.map((user) => new Option(user.name, String(user.id))),
	);
	userSelect.value = String(currentUserId);
}

async function loadProducts() {
	const searchText = byId<HTMLInputElement>('search-input').value.trim();
	const products = await api<Product[]>(
		`/api/products?q=${encodeURIComponent(searchText)}`,
	);
	byId('products').replaceChildren(...products.map(renderProduct));
}

function renderProduct(product: Product) {
	const card = fromTemplate('product-template');
	field(card, 'title').textContent = product.title;
	field(card, 'price').textContent = rubles.format(product.price);

	const stockBadge = field(card, 'stock');
	if (product.stock === 0) {
		stockBadge.textContent = 'Нет в наличии';
		stockBadge.classList.add('badge-error');
	} else if (product.stock <= 3) {
		stockBadge.textContent = `Осталось ${product.stock}`;
		stockBadge.classList.add('badge-warning');
	} else {
		stockBadge.textContent = `В наличии ${product.stock}`;
		stockBadge.classList.add('badge-success');
	}

	const addButton = card.querySelector(
		'[data-action="add"]',
	) as HTMLButtonElement;
	addButton.disabled = product.stock === 0;
	addButton.addEventListener('click', () => {
		const quantity = (cart.get(product.id)?.quantity ?? 0) + 1;
		changeCart(() =>
			cart.set(product.id, { product, quantity: Math.min(quantity, 10) }),
		);
	});

	return card;
}

function changeCart(change: () => void) {
	change();
	checkoutKey = crypto.randomUUID();
	renderCart();
}

function renderCart() {
	const lines = [...cart.values()];
	byId('cart-lines').replaceChildren(...lines.map(renderCartLine));
	byId('cart-empty').hidden = lines.length > 0;
	byId('cart-total').textContent = rubles.format(
		lines.reduce(
			(total, { product, quantity }) => total + product.price * quantity,
			0,
		),
	);
	byId<HTMLButtonElement>('checkout').disabled = lines.length === 0;
}

function renderCartLine({
	product,
	quantity,
}: {
	product: Product;
	quantity: number;
}) {
	const line = fromTemplate('cart-line-template');
	field(line, 'title').textContent = product.title;

	const quantityInput = field<HTMLInputElement>(line, 'quantity');
	quantityInput.value = String(quantity);
	quantityInput.addEventListener('change', () => {
		const newQuantity = Math.min(
			Math.max(Math.trunc(Number(quantityInput.value)) || 1, 1),
			10,
		);
		changeCart(() => cart.set(product.id, { product, quantity: newQuantity }));
	});

	line
		.querySelector('[data-action="remove"]')
		?.addEventListener('click', () => {
			changeCart(() => cart.delete(product.id));
		});

	return line;
}

async function checkout() {
	const checkoutButton = byId<HTMLButtonElement>('checkout');
	checkoutButton.disabled = true;
	checkoutButton.replaceChildren(
		Object.assign(document.createElement('span'), {
			className: 'loading loading-spinner loading-sm',
		}),
		'Оформляем…',
	);

	const startedAt = performance.now();
	try {
		const order = await api<{ id: number }>('/api/orders', {
			method: 'POST',
			headers: { 'idempotency-key': checkoutKey },
			body: JSON.stringify({
				items: [...cart.values()].map(({ product, quantity }) => ({
					productId: product.id,
					quantity,
				})),
			}),
		});
		changeCart(() => cart.clear());
		showToast(
			`Заказ №${order.id} оформлен за ${formatDuration(performance.now() - startedAt)}`,
			'success',
		);
	} catch (error) {
		showError(error);
	} finally {
		checkoutButton.textContent = 'Оформить заказ';
		renderCart();
		await loadProducts().catch(showError);
	}
}

async function loadOrders(page = ordersPage) {
	byId('orders-duration').textContent = '…';
	const startedAt = performance.now();
	const history = await api<OrderPage>(`/api/orders?page=${page}`);

	byId('orders-duration').textContent = formatDuration(
		performance.now() - startedAt,
	);
	byId('orders-count').textContent = counts.format(history.orders_count);
	byId('orders-spent').textContent = rubles.format(history.total_spent);

	ordersPage = history.page;
	ordersPages = history.pages;
	byId('orders-page').textContent = `Страница ${ordersPage} из ${ordersPages}`;
	for (const button of document.querySelectorAll<HTMLButtonElement>(
		'[data-page]',
	)) {
		const target = button.dataset.page as PageTarget;
		button.disabled = ['first', 'previous'].includes(target)
			? ordersPage === 1
			: ordersPage === ordersPages;
	}

	byId('orders').replaceChildren(...history.orders.map(renderOrder));
}

function getTargetPage(target: PageTarget) {
	return {
		first: 1,
		previous: ordersPage - 1,
		next: ordersPage + 1,
		last: ordersPages,
	}[target];
}

function renderOrder(order: Order) {
	const orderCard = fromTemplate('order-template');
	field(orderCard, 'number').textContent = `Заказ №${order.id}`;
	field(orderCard, 'date').textContent = dates.format(
		new Date(order.created_at),
	);
	field(orderCard, 'total').textContent = rubles.format(order.total);

	const [statusLabel, statusClass] = statusBadges[order.status];
	const statusBadge = field(orderCard, 'status');
	statusBadge.textContent = statusLabel;
	statusBadge.classList.add(statusClass);

	field(orderCard, 'items').replaceChildren(
		...order.items.map((item) => {
			const row = fromTemplate('order-item-template');
			field(row, 'title').textContent = item.title;
			field(row, 'quantity').textContent = String(item.quantity);
			field(row, 'price').textContent = rubles.format(item.price);
			return row;
		}),
	);

	return orderCard;
}

function showView(view: View) {
	for (const tab of document.querySelectorAll<HTMLElement>('[data-view]')) {
		tab.classList.toggle('tab-active', tab.dataset.view === view);
	}
	byId('catalog-view').hidden = view !== 'catalog';
	byId('orders-view').hidden = view !== 'orders';
	history.replaceState(null, '', view === 'orders' ? '#orders' : '/');

	const loadView = view === 'orders' ? () => loadOrders(1) : loadProducts;
	loadView().catch(showError);
}

function currentView(): View {
	return byId('orders-view').hidden ? 'catalog' : 'orders';
}

for (const tab of document.querySelectorAll<HTMLElement>('[data-view]')) {
	tab.addEventListener('click', () => showView(tab.dataset.view as View));
}

byId('user-select').addEventListener('change', (event) => {
	currentUserId = Number((event.target as HTMLSelectElement).value);
	localStorage.setItem('shop:user', String(currentUserId));
	changeCart(() => cart.clear());
	showView(currentView());
});

byId('search-form').addEventListener('submit', (event) => {
	event.preventDefault();
	loadProducts().catch(showError);
});

byId('checkout').addEventListener('click', checkout);
byId('orders-refresh').addEventListener('click', () => {
	loadOrders().catch(showError);
});

for (const button of document.querySelectorAll<HTMLButtonElement>(
	'[data-page]',
)) {
	button.addEventListener('click', () => {
		loadOrders(getTargetPage(button.dataset.page as PageTarget)).catch(
			showError,
		);
	});
}

renderCart();
loadUsers()
	.then(() => showView(location.hash === '#orders' ? 'orders' : 'catalog'))
	.catch(showError);

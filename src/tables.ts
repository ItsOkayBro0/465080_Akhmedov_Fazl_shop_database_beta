export interface UserRow {
	id: number;
	email: string;
	name: string;
	created_at: Date;
}

export interface ProductRow {
	id: number;
	title: string;
	price: number;
	stock: number;
}

export interface OrderRow {
	id: number;
	user_id: number;
	status: 'new' | 'paid' | 'shipped' | 'cancelled';
	idempotency_key: string | null;
	created_at: Date;
}

export interface OrderItemRow {
	id: number;
	order_id: number;
	product_id: number;
	quantity: number;
	price: number;
}

import * as v from 'valibot';

export const IdSchema = v.pipe(
	v.number(),
	v.integer(),
	v.minValue(1),
	v.maxValue(2_147_483_647),
);

export const IdempotencyKeySchema = v.pipe(v.string(), v.uuid());

export const PageSchema = v.pipe(
	v.string(),
	v.toNumber(),
	v.integer(),
	v.minValue(1),
	v.maxValue(1_000_000),
);

export const CheckoutSchema = v.pipe(
	v.string(),
	v.parseJson(),
	v.object({
		items: v.pipe(
			v.array(
				v.object({
					productId: IdSchema,
					quantity: v.pipe(
						v.number(),
						v.integer(),
						v.minValue(1),
						v.maxValue(10),
					),
				}),
			),
			v.minLength(1),
			v.maxLength(20),
			v.check(
				(items) =>
					new Set(items.map(({ productId }) => productId)).size
					=== items.length,
			),
		),
	}),
);

import * as v from 'valibot';

const environmentSchema = v.object({
	DATABASE_URL: v.optional(
		v.string(),
		'postgres://shop:shop@localhost:5433/shop',
	),
	PORT: v.optional(
		v.pipe(
			v.string(),
			v.toNumber(),
			v.integer(),
			v.minValue(1),
			v.maxValue(65_535),
		),
		'3000',
	),
});

export const environment = v.parse(environmentSchema, Bun.env);

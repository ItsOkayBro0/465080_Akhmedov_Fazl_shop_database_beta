-- 200 тысяч покупателей, 1000 товаров, 2 миллиона заказов
-- setseed делает данные одинаковыми у всех
SELECT setseed(0.3);

INSERT INTO users (email, name) VALUES
  ('anna@example.com', 'Анна'),
  ('boris@example.com', 'Борис'),
  ('vera@example.com', 'Вера'),
  ('gleb@example.com', 'Глеб'),
  ('orders@vector.example', 'ООО «Вектор»');

INSERT INTO users (email, name)
SELECT 'user' || g || '@example.com', 'Покупатель ' || g
FROM generate_series(6, 200000) AS g;

INSERT INTO products (title, price, stock) VALUES
  ('Ноутбук', 89990, 1),
  ('Мышь', 990, 50),
  ('Наушники', 4990, 10),
  ('Клавиатура', 2990, 20),
  ('Монитор', 19990, 5);

INSERT INTO products (title, price, stock)
SELECT
  (ARRAY[
    'Кабель USB-C', 'Чехол для телефона', 'Зарядное устройство', 'Флешка 64 ГБ',
    'Коврик для мыши', 'Настольная лампа', 'Портативная колонка', 'Веб-камера',
    'Подставка для ноутбука', 'USB-хаб'
  ])[1 + g % 10] || ', модель ' || g,
  (29 + floor(random() * 2970))::int * 10,
  floor(random() * 200)::int
FROM generate_series(6, 1000) AS g;

-- У ООО «Вектор» 40 000 заказов, у Анны, Бориса, Веры и Глеба — по 50.
INSERT INTO orders (user_id, status, created_at)
SELECT
  CASE
    WHEN g % 50 = 0 THEN 5
    WHEN g % 40000 BETWEEN 1 AND 4 THEN g % 40000
    ELSE 6 + floor(random() * 199995)::int
  END,
  (ARRAY['paid', 'shipped', 'shipped', 'paid', 'cancelled', 'new'])[1 + floor(random() * 6)::int],
  now() - random() * interval '730 days'
FROM generate_series(1, 2000000) AS g;

-- В заказе от одного до четырёх разных товаров.
INSERT INTO order_items (order_id, product_id, quantity, price)
SELECT line.order_id, products.id, line.quantity, products.price
FROM (
  SELECT
    orders.id AS order_id,
    1 + (floor(random() * 250)::int + item * 250) % 1000 AS product_id,
    1 + floor(random() * 3)::int AS quantity
  FROM orders
  CROSS JOIN LATERAL generate_series(1, 1 + orders.id % 4) AS item
) AS line
JOIN products ON products.id = line.product_id;

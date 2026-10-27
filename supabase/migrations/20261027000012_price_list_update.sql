-- Product list update from the owner's price list. Idempotent. On a fresh database the new brand/products are created here and the Isley/Sugarhill figures come from seed.sql.
-- New products start with a placeholder stock of 25 (stock was not on the price list): set real counts in the admin portal before selling.
-- No photos yet for the new products; the product page shows its "no photo" state until they are added in admin.
-- Retail prices from the owner's marked-up price list (pen prices on the green-highlighted rows).
update products set price_cents = 42999, vitola = 'Box Press Torpedo',
  short_description = 'Box Press Torpedo, 60 x 6.75. Box of 10. Handcrafted in the Dominican Republic.', placeholder_price = false
where sku = 'ISLEY-PLUG-60X675-10';
update products set price_cents = 34999, box_quantity = 20, ring_gauge = 60, length_in = 6, wrapper = 'Habano',
  name = 'Sugarhill "Rapper''s Delight" — Box of 20', short_description = 'Box of 20, 60 x 6, Habano wrapper. Handcrafted in the Dominican Republic.',
  description = 'Rapper''s Delight, the first Sugarhill release, presented in a lacquered black and gold humidor-style box. Sold by the box only.',
  placeholder_price = false
where sku = 'SUGARHILL-RD-10';
insert into brands (slug, name, tagline, short_description, logo_path, accent_color, template, display_order)
select 'lion-cigars', 'Lion Cigars', 'Premium Cigars', 'Premium cigars by Lion Cigars, sold by the box.', '/images/crest.png', '#d6ad68', 'default', 30
where not exists (select 1 from brands where slug = 'lion-cigars');
insert into products (brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity, vitola, length_in, ring_gauge, wrapper, placeholder_price)
select * from (values
((select id from brands where slug='lion-cigars'), 'gran-corona-box-of-20', 'LION-GRANCORONA-60X6-20', 'Gran Corona — Box of 20', 'Gran Corona, 60 x 6. Box of 20.', 'Sold by the box only.', 22999, 25, 20, 'Gran Corona', 6, 60, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'double-maduro-toro-box-of-20', 'LION-DMTORO-52X6-20', 'Double Maduro Toro — Box of 20', 'Double Maduro Toro, 52 x 6. Box of 20.', 'Sold by the box only.', 22999, 25, 20, 'Double Maduro Toro', 6, 52, 'San Andres', false),
((select id from brands where slug='lion-cigars'), 'maduro-torpedo-box-of-20', 'LION-MADTORPEDO-52X6-20', 'Maduro Torpedo — Box of 20', 'Maduro Torpedo, 52 x 6. Box of 20.', 'Sold by the box only.', 22999, 25, 20, 'Maduro Torpedo', 6, 52, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'belicoso-box-of-20', 'LION-BELICOSO-50X525-20', 'Belicoso — Box of 20', 'Belicoso, 50 x 5.25. Box of 20.', 'Sold by the box only.', 21999, 25, 20, 'Belicoso', 5.25, 50, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'robusto-box-of-20', 'LION-ROBUSTO-50X5-20', 'Robusto — Box of 20', 'Robusto, 50 x 5. Box of 20.', 'Sold by the box only.', 21999, 25, 20, 'Robusto', 5, 50, 'Connecticut', false),
((select id from brands where slug='lion-cigars'), 'cardinal-box-press-box-of-10', 'LION-CARDINALBP-60X675-10', 'Cardinal Box Press — Box of 10', 'Box Press, 60 x 6.75. Box of 10.', 'Sold by the box only.', 24999, 25, 10, 'Box Press', 6.75, 60, 'Corojo', false),
((select id from brands where slug='lion-cigars'), 'cardinal-perfecto-box-of-10', 'LION-CARDINALPF-60X6-10', 'Cardinal Perfecto — Box of 10', 'Perfecto, 60 x 6. Box of 10.', 'Sold by the box only.', 23999, 25, 10, 'Perfecto', 6, 60, 'Corojo', false),
((select id from brands where slug='lion-cigars'), 'suarez-lancero-box-of-10', 'LION-SUAREZLANCERO-44X7-10', 'Suarez Lancero — Box of 10', 'Lancero, 44 x 7. Box of 10.', 'Sold by the box only.', 17999, 25, 10, 'Lancero', 7, 44, 'Cameroon', false),
((select id from brands where slug='lion-cigars'), 'vanilla-cigarillo-box-of-10', 'LION-CIGARILLO-VANILLA-10', 'Vanilla Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'cherry-cigarillo-box-of-10', 'LION-CIGARILLO-CHERRY-10', 'Cherry Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'cognac-cigarillo-box-of-10', 'LION-CIGARILLO-COGNAC-10', 'Cognac Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'chocolate-cigarillo-box-of-10', 'LION-CIGARILLO-CHOCOLATE-10', 'Chocolate Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'espresso-cigarillo-box-of-10', 'LION-CIGARILLO-ESPRESSO-10', 'Espresso Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'variety-cigarillo-box-of-10', 'LION-CIGARILLO-VARIETY-10', 'Variety Cigarillo — Box of 10', 'Cigarillo. Box of 10.', 'Sold by the box only.', 1499, 25, 10, 'Cigarillo', null, null, 'Habana', false),
((select id from brands where slug='lion-cigars'), 'natural-premium-cigarillo-box-of-100', 'LION-CIGARILLO-NATURAL-100', 'Natural Premium Cigarillo — Box of 100', 'Cigarillo. Box of 100.', 'Sold by the box only.', 24999, 25, 100, 'Cigarillo', null, null, 'Cameroon', false)
) as v(brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity, vitola, length_in, ring_gauge, wrapper, placeholder_price)
where exists (select 1 from brands where slug = 'lion-cigars')
  and not exists (select 1 from products p where p.sku = v.sku);

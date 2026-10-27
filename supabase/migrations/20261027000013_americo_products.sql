-- Americo Cigars boxes from the owner's price list (green-highlighted rows, pen prices). Idempotent.
-- Placeholder stock of 25 and no photos yet: set real counts and add photos in the admin portal.
-- The boxes/cigarillos brand from migration 12 is Compadres Cigars (the storefront company name stays Lion Cigars). Idempotent.
update brands set slug = 'compadres-cigars', name = 'Compadres Cigars', short_description = 'Premium cigars by Compadres Cigars, sold by the box.'
where slug = 'lion-cigars' and not exists (select 1 from brands where slug = 'compadres-cigars');
insert into brands (slug, name, tagline, short_description, logo_path, accent_color, template, display_order)
select 'americo-cigars', 'Americo Cigars', 'Premium Cigars', 'Premium cigars by Americo Cigars, sold by the box.', '/images/crest.png', '#d6ad68', 'default', 40
where not exists (select 1 from brands where slug = 'americo-cigars');
insert into products (brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity, vitola, length_in, ring_gauge, wrapper, placeholder_price)
select * from (values
((select id from brands where slug='americo-cigars'), 'aniversario-robusto-box-of-20', 'AMERICO-ANIVERSARIO-ROBUSTO-52X55-20', 'Aniversario Robusto — Box of 20', 'Robusto, 52 x 5.5. Box of 20.', 'Sold by the box only.', 25999, 25, 20, 'Robusto', 5.5, 52, 'Connecticut Ecuador', false),
((select id from brands where slug='americo-cigars'), 'aniversario-perfecto-box-of-20', 'AMERICO-ANIVERSARIO-PERFECTO-55X5-20', 'Aniversario Perfecto — Box of 20', 'Perfecto, 55 x 5. Box of 20.', 'Sold by the box only.', 26999, 25, 20, 'Perfecto', 5, 55, 'Connecticut Ecuador', false),
((select id from brands where slug='americo-cigars'), 'big-father-robusto-box-of-20', 'AMERICO-BIGFATHER-ROBUSTO-52X55-20', 'Big Father Robusto — Box of 20', 'Robusto, 52 x 5.5. Box of 20.', 'Sold by the box only.', 26999, 25, 20, 'Robusto', 5.5, 52, 'Connecticut Ecuador', false),
((select id from brands where slug='americo-cigars'), 'big-father-torpedo-box-of-20', 'AMERICO-BIGFATHER-TORPEDO-52X6-20', 'Big Father Torpedo — Box of 20', 'Torpedo, 52 x 6. Box of 20.', 'Sold by the box only.', 26999, 25, 20, 'Torpedo', 6, 52, 'Connecticut Ecuador', false),
((select id from brands where slug='americo-cigars'), 'palmera-reserva-robusto-box-of-20', 'AMERICO-PALMERA-ROBUSTO-52X55-20', 'Palmera Reserva Robusto — Box of 20', 'Robusto, 52 x 5.5. Box of 20.', 'Sold by the box only.', 26999, 25, 20, 'Robusto', 5.5, 52, 'Habano Ecuador', false),
((select id from brands where slug='americo-cigars'), 'palmera-reserva-churchill-box-of-20', 'AMERICO-PALMERA-CHURCHILL-50X65-20', 'Palmera Reserva Churchill — Box of 20', 'Churchill, 50 x 6.5. Box of 20.', 'Sold by the box only.', 26999, 25, 20, 'Churchill', 6.5, 50, 'Habano Ecuador', false),
((select id from brands where slug='americo-cigars'), 'don-leo-reserva-especial-toro-box-of-20', 'AMERICO-DONLEO-TORO-54X55-20', 'Don Leo Reserva Especial Toro — Box of 20', 'Toro, 54 x 5.5. Box of 20.', 'Sold by the box only.', 28999, 25, 20, 'Toro', 5.5, 54, 'San Andres Mexico', false),
((select id from brands where slug='americo-cigars'), 'don-leo-reserva-especial-torpedo-box-of-20', 'AMERICO-DONLEO-TORPEDO-52X55-20', 'Don Leo Reserva Especial Torpedo — Box of 20', 'Torpedo, 52 x 5.5. Box of 20.', 'Sold by the box only.', 28999, 25, 20, 'Torpedo', 5.5, 52, 'San Andres Mexico', false)
) as v(brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity, vitola, length_in, ring_gauge, wrapper, placeholder_price)
where exists (select 1 from brands where slug = 'americo-cigars')
  and not exists (select 1 from products p where p.sku = v.sku);

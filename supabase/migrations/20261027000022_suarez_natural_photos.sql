-- Compadres Suarez Lancero (box of 10) and Natural Premium cigarillos (box of 100) photos. Idempotent; a product that does not exist is skipped.
insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
  ('LION-SUAREZLANCERO-44X7-10', '/images/compadres-suarez-open-lid.jpg', 'Open turquoise Compadres Suarez box with ten Lancero cigars with blue and gold bands', 0),
  ('LION-SUAREZLANCERO-44X7-10', '/images/compadres-suarez-closed.jpg', 'Closed turquoise Compadres Suarez box with the gold lion crest', 1),
  ('LION-SUAREZLANCERO-44X7-10', '/images/compadres-suarez-open-top.jpg', 'Ten Suarez Lancero cigars in their cedar-lined box, seen from above', 2),
  ('LION-CIGARILLO-NATURAL-100', '/images/compadres-natural-premium-box.jpg', 'Open wooden box of 100 Compadres Natural Premium Tobacco cigarillos', 0)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

-- Americo Cigars brand photography: logo, hero banner, and three photos on each Americo product. Idempotent;
-- a no-op when the brand or its products do not exist yet.
update brands set logo_path = '/images/americo-logo.png', hero_path = '/images/americo-field-pair.jpg'
where slug = 'americo-cigars';
insert into product_images (product_id, path, alt, position)
select p.id, i.path, i.alt, i.position
from products p
join brands b on b.id = p.brand_id and b.slug = 'americo-cigars'
cross join (values
  ('/images/americo-humidor.jpg', 'Blue Americo Cigars humidor with a glass lid, showing cigars inside', 0),
  ('/images/americo-field-pair.jpg', 'Two men in Americo Cigars hats and shirts talking among tobacco plants', 1),
  ('/images/americo-field-smoke.jpg', 'A man in an Americo Cigars hat and shirt smoking a cigar in a tobacco field', 2)
) as i(path, alt, position)
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = i.path);

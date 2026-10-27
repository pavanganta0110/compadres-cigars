-- Americo Cigars: three more photos from americocigars.com on every Americo product (after the line photo). Idempotent.
insert into product_images (product_id, path, alt, position)
select p.id, i.path, i.alt, i.position
from products p
join brands b on b.id = p.brand_id and b.slug = 'americo-cigars'
cross join (values
  ('/images/americo-ritual.jpg', 'Four Americo cigars, Big Father, Aniversario, Don Leo and Palmera, side by side', 3),
  ('/images/americo-craft.jpg', 'A roller sorting tobacco leaves at the Americo factory', 4),
  ('/images/americo-mural.jpg', 'Mural of a tobacco farm and a farmer smoking a cigar among the plants', 5)
) as i(path, alt, position)
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = i.path);

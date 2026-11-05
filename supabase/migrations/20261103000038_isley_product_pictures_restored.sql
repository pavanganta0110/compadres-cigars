-- Ronald Isley "The Plug": the original product pictures lead the gallery again; the real photographs follow. Idempotent.
update product_images set position = position + 10
where path in ('/images/isley-box-open.jpg', '/images/isley-cigar-wide.jpg', '/images/isley-box-spine.jpg', '/images/isley-cigar.jpg')
  and position < 10
  and product_id in (select id from products where sku = 'ISLEY-PLUG-60X675-10');

insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
  ('ISLEY-PLUG-60X675-10', '/images/isley-open-box.jpg', 'Open box of ten Ronald Isley The Plug cigars with the gold Gold Standard seal', 0),
  ('ISLEY-PLUG-60X675-10', '/images/isley-box-and-cigar.jpg', 'Ronald Isley The Plug open box with a single cigar and the closed black box', 1),
  ('ISLEY-PLUG-60X675-10', '/images/isley-cigar-standing.jpg', 'A single Ronald Isley The Plug belicoso cigar with its gold and black bands', 2),
  ('ISLEY-PLUG-60X675-10', '/images/isley-box-closed-gold.jpg', 'The closed black lacquer Ronald Isley box with a gold seal', 3)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

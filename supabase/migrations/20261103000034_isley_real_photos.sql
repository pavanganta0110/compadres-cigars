-- Ronald Isley "The Plug": make sure the product has its real photographs. (Removing the AI renders left some databases with no photos.)
-- Idempotent: only adds a photo the product does not already have.
insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
  ('ISLEY-PLUG-60X675-10', '/images/isley-box-open.jpg', 'Open box of ten Ronald Isley The Plug cigars', 0),
  ('ISLEY-PLUG-60X675-10', '/images/isley-cigar-wide.jpg', 'A single Ronald Isley The Plug belicoso cigar', 1),
  ('ISLEY-PLUG-60X675-10', '/images/isley-box-spine.jpg', 'Box spine reading 10 Cigars, The Plug, 60 x 6.75', 2)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

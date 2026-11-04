-- The official "website" composites (box or four-pack with a single cigar), rendered from the original artwork at 2000px.
-- Robusto and Gran Corona four-packs switch to the composite; Robusto and Torpedo get the box composite as an extra photo. Idempotent.
-- (The Toro and Gran Corona box composites are clipped by their artboards, so those products keep the uncut box cutouts.)
update product_images set path = '/images/compadres-robusto-4pk-website.png', alt = 'Compadres Robusto four-pack with a single Robusto cigar standing beside it'
  where path = '/images/compadres-robusto-4pk.png';
update product_images set path = '/images/compadres-gran-corona-4pk-website.png', alt = 'Compadres Gran Corona four-pack with a single Gran Corona cigar standing beside it'
  where path = '/images/compadres-gran-corona-4pk.png';

insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
  ('LION-ROBUSTO-50X5-20', '/images/compadres-robusto-box-website.png', 'Open Compadres Robusto box of 20 with a single Robusto cigar standing beside it', 3),
  ('LION-MADTORPEDO-52X6-20', '/images/compadres-torpedo-box-website.png', 'Open Compadres Maduro Torpedo box of 20 with a single Torpedo cigar standing beside it', 3)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

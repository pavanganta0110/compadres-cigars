-- Compadres product photography from the studio shoot: sharp box and four-pack cutouts, studio shots and single-cigar shots.
-- Idempotent: updates only touch the old photo paths, inserts only add a path a product does not already have.

-- 1. Replace the low-resolution photos
update product_images set path = '/images/compadres-robusto-4pk.png', alt = 'Compadres Robusto four-pack with its sliding lid and four cigars'
  where path = '/images/compadres-robusto-pack.jpg';
update product_images set path = '/images/compadres-gran-corona-box-20.png', alt = 'Open Compadres Gran Corona box of 20 with a gold ribbon'
  where path in ('/images/compadres-gran-corona-box.jpg', '/images/compadres-gran-corona-box-cigar.jpg');
update product_images set path = '/images/compadres-gran-corona-4pk.png', alt = 'Compadres Gran Corona four-pack with its sliding lid and four cigars'
  where path = '/images/compadres-gran-corona-pack.jpg';
update product_images set path = '/images/compadres-double-maduro-toro-box-20.png', alt = 'Open Compadres Double Maduro Toro box of 20 with a red ribbon'
  where path = '/images/compadres-double-maduro-toro-box.jpg';
update product_images set path = '/images/compadres-double-maduro-toro-4pk.jpg', alt = 'Compadres Double Maduro Toro four-pack with its sliding lid and four cigars'
  where path = '/images/compadres-double-maduro-toro-pack.jpg';
update product_images set path = '/images/compadres-belicoso-box-20.png', alt = 'Open Compadres Belicoso box of 20'
  where path = '/images/compadres-belicoso-box.jpg';
update product_images set path = '/images/compadres-belicoso-single.jpg', alt = 'A single Compadres Belicoso cigar with its black and gold band'
  where path = '/images/compadres-belicoso-cigar.jpg';

-- 2. Cigarillo boxes: the studio shot leads, the existing photo follows
update product_images set position = position + 10
  where path in ('/images/compadres-cigarillo-vanilla-box.jpg', '/images/compadres-cigarillo-cognac-box.jpg') and position < 10;

-- 3. Add the studio and single-cigar shots
insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
  ('LION-ROBUSTO-50X5-20', '/images/compadres-robusto-studio.jpg', 'Open Compadres Robusto box of 20, photographed from above', 4),
  ('LION-ROBUSTO-50X5-20', '/images/compadres-robusto-single.jpg', 'A single Compadres Robusto cigar with its black and gold band', 5),
  ('LION-MADTORPEDO-52X6-20', '/images/compadres-torpedo-studio.jpg', 'Open Compadres Maduro Torpedo box of 20 with a gold ribbon', 4),
  ('LION-MADTORPEDO-52X6-20', '/images/compadres-torpedo-single.jpg', 'A single Compadres Maduro Torpedo cigar with its black and gold band', 5),
  ('LION-BELICOSO-50X525-20', '/images/compadres-belicoso-studio.jpg', 'Open Compadres Belicoso box of 20, photographed from above', 4),
  ('LION-GRANCORONA-60X6-20', '/images/compadres-gran-corona-studio.jpg', 'Open Compadres Gran Corona box of 20 with a gold ribbon, photographed from above', 4),
  ('LION-GRANCORONA-60X6-20', '/images/compadres-gran-corona-studio-2.jpg', 'Compadres Gran Corona cigars in their open box, close up', 5),
  ('LION-DMTORO-52X6-20', '/images/compadres-toro-studio.jpg', 'Open Compadres Double Maduro Toro box of 20 with a red ribbon', 4),
  ('LION-DMTORO-52X6-20', '/images/compadres-toro-overhead.jpg', 'Open Compadres Double Maduro Toro box of 20, photographed from above', 5),
  ('LION-CIGARILLO-VANILLA-10', '/images/compadres-cigarillo-vanilla-studio.jpg', 'Open box of ten Compadres Vanilla cigarillos', 0),
  ('LION-CIGARILLO-COGNAC-10', '/images/compadres-cigarillo-cognac-studio.jpg', 'Open box of ten Compadres Cognac cigarillos', 0),
  ('LION-CIGARILLO-CHERRY-10', '/images/compadres-cigarillo-cherry-studio.jpg', 'Open box of ten Compadres Cherry cigarillos', 0),
  ('LION-CIGARILLO-CHOCOLATE-10', '/images/compadres-cigarillo-chocolate-studio.jpg', 'Open box of ten Compadres Chocolate cigarillos', 0)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

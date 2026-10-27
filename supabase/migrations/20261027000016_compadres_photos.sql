-- Compadres Cigars product photos (cropped from the catalog). Idempotent; a product that does not exist is skipped.
-- Cherry, Chocolate, Espresso, Variety and Natural Premium cigarillos and Suarez Lancero have no photo yet.
insert into product_images (product_id, path, alt, position)
select p.id, v.path, v.alt, v.position
from (values
('LION-GRANCORONA-60X6-20', '/images/compadres-gran-corona-box.jpg', 'Open Compadres Gran Corona box of 20 with black lid', 0),
('LION-GRANCORONA-60X6-20', '/images/compadres-gran-corona-pack.jpg', 'Compadres Gran Corona cigar on its black four-pack box', 1),
('LION-DMTORO-52X6-20', '/images/compadres-double-maduro-toro-box.jpg', 'Open Compadres Double Maduro Toro box of 20 with a red ribbon', 0),
('LION-DMTORO-52X6-20', '/images/compadres-double-maduro-toro-pack.jpg', 'Compadres Double Maduro Toro cigar on its black four-pack box', 1),
('LION-MADTORPEDO-52X6-20', '/images/compadres-maduro-torpedo-box.jpg', 'Open Compadres Maduro Torpedo box of 20 with a red ribbon', 0),
('LION-MADTORPEDO-52X6-20', '/images/compadres-maduro-torpedo-pack.jpg', 'Compadres Maduro Torpedo cigar on its black four-pack box', 1),
('LION-BELICOSO-50X525-20', '/images/compadres-belicoso-box.jpg', 'Open Compadres Belicoso box of 20 with a gold ribbon', 0),
('LION-BELICOSO-50X525-20', '/images/compadres-belicoso-cigar.jpg', 'A single Compadres Belicoso cigar with its black and gold band', 1),
('LION-ROBUSTO-50X5-20', '/images/compadres-robusto-box.jpg', 'Open Compadres Robusto box of 20 with a gold ribbon', 0),
('LION-ROBUSTO-50X5-20', '/images/compadres-robusto-pack.jpg', 'Compadres Robusto cigar on its black four-pack box', 1),
('LION-CARDINALBP-60X675-10', '/images/compadres-cardinal-box-press-box.jpg', 'Open red-lined Compadres Cardinal Box Press box of 10', 0),
('LION-CARDINALBP-60X675-10', '/images/compadres-cardinal-box-press-cigar.jpg', 'A single Cardinal Box Press cigar with a red foot and black and gold band', 1),
('LION-CARDINALPF-60X6-10', '/images/compadres-cardinal-perfecto-box.jpg', 'Open red-lined Compadres Cardinal Perfecto box of 10', 0),
('LION-CARDINALPF-60X6-10', '/images/compadres-cardinal-perfecto-cigar.jpg', 'A single Cardinal Perfecto cigar with its black and gold band', 1),
('LION-CIGARILLO-VANILLA-10', '/images/compadres-cigarillo-vanilla-box.jpg', 'Open box of ten Compadres Vanilla cigarillos', 0),
('LION-CIGARILLO-COGNAC-10', '/images/compadres-cigarillo-cognac-box.jpg', 'Open box of ten Compadres Cognac cigarillos', 0)
) as v(sku, path, alt, position)
join products p on p.sku = v.sku
where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path);

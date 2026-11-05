-- Belicoso and Robusto single-cigar pictures re-cut so the band is whole. Idempotent.
delete from product_images o where o.path = '/images/compadres-belicoso-single-black.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-belicoso-single-whole.jpg');
update product_images set path = '/images/compadres-belicoso-single-whole.jpg' where path = '/images/compadres-belicoso-single-black.jpg';
delete from product_images o where o.path = '/images/compadres-robusto-single-black.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-robusto-single-whole.jpg');
update product_images set path = '/images/compadres-robusto-single-whole.jpg' where path = '/images/compadres-robusto-single-black.jpg';

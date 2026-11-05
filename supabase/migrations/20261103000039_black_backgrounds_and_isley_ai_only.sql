-- Every product picture sits on black; the Ronald Isley gallery keeps only the four product pictures. Idempotent.
delete from product_images o where o.path = '/images/compadres-belicoso-single.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-belicoso-single-black.jpg');
update product_images set path = '/images/compadres-belicoso-single-black.jpg' where path = '/images/compadres-belicoso-single.jpg';
delete from product_images o where o.path = '/images/compadres-robusto-single.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-robusto-single-black.jpg');
update product_images set path = '/images/compadres-robusto-single-black.jpg' where path = '/images/compadres-robusto-single.jpg';
delete from product_images o where o.path = '/images/compadres-torpedo-single.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-torpedo-single-black.jpg');
update product_images set path = '/images/compadres-torpedo-single-black.jpg' where path = '/images/compadres-torpedo-single.jpg';
delete from product_images o where o.path = '/images/compadres-torpedo-box-cigar.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-torpedo-box-cigar-black.jpg');
update product_images set path = '/images/compadres-torpedo-box-cigar-black.jpg' where path = '/images/compadres-torpedo-box-cigar.jpg';
delete from product_images o where o.path = '/images/compadres-cigarillo-cherry-studio.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cigarillo-cherry-black.jpg');
update product_images set path = '/images/compadres-cigarillo-cherry-black.jpg' where path = '/images/compadres-cigarillo-cherry-studio.jpg';
delete from product_images o where o.path = '/images/compadres-cigarillo-chocolate-studio.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cigarillo-chocolate-black.jpg');
update product_images set path = '/images/compadres-cigarillo-chocolate-black.jpg' where path = '/images/compadres-cigarillo-chocolate-studio.jpg';
delete from product_images o where o.path = '/images/compadres-cigarillo-cognac-studio.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cigarillo-cognac-black.jpg');
update product_images set path = '/images/compadres-cigarillo-cognac-black.jpg' where path = '/images/compadres-cigarillo-cognac-studio.jpg';
delete from product_images o where o.path = '/images/compadres-cigarillo-vanilla-studio.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cigarillo-vanilla-black.jpg');
update product_images set path = '/images/compadres-cigarillo-vanilla-black.jpg' where path = '/images/compadres-cigarillo-vanilla-studio.jpg';
delete from product_images o where o.path = '/images/compadres-cardinal-box-press-box.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cardinal-box-press-box-black.jpg');
update product_images set path = '/images/compadres-cardinal-box-press-box-black.jpg' where path = '/images/compadres-cardinal-box-press-box.jpg';
delete from product_images o where o.path = '/images/compadres-cardinal-box-press-cigar.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cardinal-box-press-cigar-black.jpg');
update product_images set path = '/images/compadres-cardinal-box-press-cigar-black.jpg' where path = '/images/compadres-cardinal-box-press-cigar.jpg';
delete from product_images o where o.path = '/images/compadres-cardinal-perfecto-box.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cardinal-perfecto-box-black.jpg');
update product_images set path = '/images/compadres-cardinal-perfecto-box-black.jpg' where path = '/images/compadres-cardinal-perfecto-box.jpg';
delete from product_images o where o.path = '/images/compadres-cardinal-perfecto-cigar.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cardinal-perfecto-cigar-black.jpg');
update product_images set path = '/images/compadres-cardinal-perfecto-cigar-black.jpg' where path = '/images/compadres-cardinal-perfecto-cigar.jpg';
delete from product_images o where o.path = '/images/compadres-cigarillo-stack.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-cigarillo-stack.png');
update product_images set path = '/images/compadres-cigarillo-stack.png' where path = '/images/compadres-cigarillo-stack.jpg';

-- Photographs taken on a white table or by a window are dropped; the black box pictures remain.
delete from product_images where path in (
  '/images/compadres-belicoso-studio.jpg', '/images/compadres-toro-studio.jpg', '/images/compadres-toro-overhead.jpg',
  '/images/compadres-gran-corona-studio.jpg', '/images/compadres-gran-corona-studio-2.jpg',
  '/images/compadres-torpedo-studio.jpg', '/images/compadres-robusto-studio.jpg',
  '/images/compadres-cigarillo-cognac-box.jpg', '/images/compadres-cigarillo-vanilla-box.jpg'
);

-- Ronald Isley: only the four product pictures.
delete from product_images
where path in ('/images/isley-box-open.jpg', '/images/isley-cigar-wide.jpg', '/images/isley-box-spine.jpg', '/images/isley-cigar.jpg')
  and product_id in (select id from products where sku = 'ISLEY-PLUG-60X675-10');

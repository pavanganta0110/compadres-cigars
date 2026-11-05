-- Compadres Cigars: the story is about the cigars (the company and founder details are removed). Idempotent;
-- it only replaces the earlier long version (which mentions GEO Foods), so copy edited in the admin is left alone.
update brands set story = E'Compadres Cigars are hand made in Tamboril, Dominican Republic, the world capital of cigars. Each cigar is made with hand-selected tobacco, free of chemicals and dyes, and carefully inspected for the finest result.\n\nThe Main Line comes in five shapes, from the light, nutty Connecticut Robusto to the full-bodied, chocolatey Double Maduro Toro. In between are the sweet, earthy Belicoso, the Maduro Torpedo with its hint of espresso and leather, and the 60-ring Gran Corona, medium to full and smooth from the first draw to the last.\n\nFrom the tobacco fields to the finished cigar, every step is closely monitored and done by hand, for quality and consistency. The Cardinal line adds box-pressed and perfecto shapes, and flavored cigarillos round out the collection.'
where slug = 'compadres-cigars' and story like '%GEO Foods%';

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

-- Ronald Isley: the picture with the standing cigar no longer shows the small nub on top of the cigar. Idempotent.
delete from product_images o where o.path = '/images/isley-box-and-cigar.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/isley-box-and-cigar-clean.jpg');
update product_images set path = '/images/isley-box-and-cigar-clean.jpg' where path = '/images/isley-box-and-cigar.jpg';

-- Natural Premium and Suarez Lancero pictures cut out onto black; the close-up that cannot be cut out is dropped. Idempotent.
delete from product_images o where o.path = '/images/compadres-natural-premium-box.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-natural-premium-box-black.jpg');
update product_images set path = '/images/compadres-natural-premium-box-black.jpg' where path = '/images/compadres-natural-premium-box.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-open-lid.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-open-lid-black.jpg');
update product_images set path = '/images/compadres-suarez-open-lid-black.jpg' where path = '/images/compadres-suarez-open-lid.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-closed.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-closed-black.jpg');
update product_images set path = '/images/compadres-suarez-closed-black.jpg' where path = '/images/compadres-suarez-closed.jpg';
delete from product_images where path = '/images/compadres-suarez-open-top.jpg';

-- Ronald Isley keeps three product pictures (closed-box picture removed); Natural Premium and Suarez use the new clean cut-outs. Idempotent.
delete from product_images
where path = '/images/isley-box-closed-gold.jpg'
  and product_id in (select id from products where sku = 'ISLEY-PLUG-60X675-10');
delete from product_images o where o.path = '/images/compadres-natural-premium-box-black.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-natural-premium-box-cut.jpg');
update product_images set path = '/images/compadres-natural-premium-box-cut.jpg' where path = '/images/compadres-natural-premium-box-black.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-open-lid-black.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-open-lid-cut.jpg');
update product_images set path = '/images/compadres-suarez-open-lid-cut.jpg' where path = '/images/compadres-suarez-open-lid-black.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-closed-black.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-closed-cut.jpg');
update product_images set path = '/images/compadres-suarez-closed-cut.jpg' where path = '/images/compadres-suarez-closed-black.jpg';


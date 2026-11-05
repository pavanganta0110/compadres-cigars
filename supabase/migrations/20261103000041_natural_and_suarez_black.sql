-- Natural Premium and Suarez Lancero pictures cut out onto black; the close-up that cannot be cut out is dropped. Idempotent.
delete from product_images o where o.path = '/images/compadres-natural-premium-box.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-natural-premium-box-black.jpg');
update product_images set path = '/images/compadres-natural-premium-box-black.jpg' where path = '/images/compadres-natural-premium-box.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-open-lid.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-open-lid-black.jpg');
update product_images set path = '/images/compadres-suarez-open-lid-black.jpg' where path = '/images/compadres-suarez-open-lid.jpg';
delete from product_images o where o.path = '/images/compadres-suarez-closed.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/compadres-suarez-closed-black.jpg');
update product_images set path = '/images/compadres-suarez-closed-black.jpg' where path = '/images/compadres-suarez-closed.jpg';
delete from product_images where path = '/images/compadres-suarez-open-top.jpg';

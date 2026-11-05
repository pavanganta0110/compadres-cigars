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

-- Ronald Isley: the picture with the standing cigar no longer shows the small nub on top of the cigar. Idempotent.
delete from product_images o where o.path = '/images/isley-box-and-cigar.jpg' and exists (select 1 from product_images n where n.product_id = o.product_id and n.path = '/images/isley-box-and-cigar-clean.jpg');
update product_images set path = '/images/isley-box-and-cigar-clean.jpg' where path = '/images/isley-box-and-cigar.jpg';

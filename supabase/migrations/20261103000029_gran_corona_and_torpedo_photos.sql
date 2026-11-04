-- Gran Corona: the first photo becomes the box with its cigar. Maduro Torpedo: adds a box-and-cigar photo as its third. Idempotent.
update product_images
set path = '/images/compadres-gran-corona-box-cigar.jpg',
    alt = 'Open Compadres Gran Corona box of 20 with a gold ribbon and a single Gran Corona cigar standing beside it'
where path = '/images/compadres-gran-corona-box.jpg';

insert into product_images (product_id, path, alt, position)
select p.id, '/images/compadres-torpedo-box-cigar.jpg', 'Open Compadres Maduro Torpedo box of 20 with a single Torpedo cigar standing beside it', 2
from products p
where p.sku = 'LION-MADTORPEDO-52X6-20'
  and not exists (select 1 from product_images x where x.product_id = p.id and x.path = '/images/compadres-torpedo-box-cigar.jpg');

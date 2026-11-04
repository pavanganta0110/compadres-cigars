-- Double Maduro Toro: the four-pack photo becomes the sharp transparent artwork (was a 704px website JPG).
-- Variety cigarillo: the stack of all four flavor boxes from the studio scenes. Idempotent.
update product_images set path = '/images/compadres-double-maduro-toro-4pk.png'
where path = '/images/compadres-double-maduro-toro-4pk.jpg';

insert into product_images (product_id, path, alt, position)
select p.id, '/images/compadres-cigarillo-stack.jpg', 'A stack of Compadres cigarillo boxes: Cognac, Vanilla, Cherry and Chocolate', 0
from products p
where p.sku = 'LION-CIGARILLO-VARIETY-10'
  and not exists (select 1 from product_images x where x.product_id = p.id and x.path = '/images/compadres-cigarillo-stack.jpg');

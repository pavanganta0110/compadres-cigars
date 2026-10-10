-- Ronald Isley: new product photography goes first (old photos are kept after it) and a new brand banner.
-- Idempotent, and a no-op when the product or brand does not exist yet (fresh databases get the same data from seed.sql).
do $$
declare v_product uuid;
begin
  select id into v_product from products where sku = 'ISLEY-PLUG-60X675-10';
  if v_product is not null and not exists (select 1 from product_images where product_id = v_product and path = '/images/isley-open-box.jpg') then
    update product_images set position = position + 10 where product_id = v_product;
    insert into product_images (product_id, path, alt, position) values
      (v_product, '/images/isley-open-box.jpg', 'Open box of ten Ronald Isley The Plug cigars with the gold Gold Standard seal', 0),
      (v_product, '/images/isley-box-and-cigar.jpg', 'Ronald Isley The Plug open box with a single cigar and the closed black box', 1),
      (v_product, '/images/isley-cigar-standing.jpg', 'A single Ronald Isley The Plug belicoso cigar with its gold and black bands', 2),
      (v_product, '/images/isley-box-closed-gold.jpg', 'The closed black lacquer Ronald Isley box with a gold seal', 3);
  end if;
  update brands set hero_path = '/images/isley-lounge.jpg' where slug = 'ronald-isley' and hero_path = '/images/isley-box-open.jpg';
end $$;

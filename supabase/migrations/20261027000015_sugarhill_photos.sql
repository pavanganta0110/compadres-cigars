-- Sugarhill "Rapper's Delight": new photography goes first (old photos are kept after it), plus the brand logo and a new banner.
-- Idempotent, and a no-op when the product or brand does not exist yet.
do $$
declare v_product uuid;
begin
  select id into v_product from products where sku = 'SUGARHILL-RD-10';
  if v_product is not null and not exists (select 1 from product_images where product_id = v_product and path = '/images/sugarhill-box-open-new.jpg') then
    update product_images set position = position + 10 where product_id = v_product;
    insert into product_images (product_id, path, alt, position) values
      (v_product, '/images/sugarhill-box-open-new.jpg', 'Open Rapper''s Delight box with ten cigars and a gold vinyl record lid', 0),
      (v_product, '/images/sugarhill-band-closeup.jpg', 'Close-up of the black vinyl record cigar band with the Sugarhill logo', 1),
      (v_product, '/images/sugarhill-cigar-single.jpg', 'A single Rapper''s Delight cigar with its vinyl record band', 2);
  end if;
  update brands set logo_path = '/images/sugarhill-logo.jpg', hero_path = '/images/sugarhill-box-open-new.jpg'
  where slug = 'sugarhill' and hero_path = '/images/sugarhill-box-open.jpg';
end $$;

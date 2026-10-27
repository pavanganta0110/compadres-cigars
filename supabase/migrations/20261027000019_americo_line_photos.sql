-- Americo Cigars: a studio photo of each line goes first on its products (existing photos are kept after it).
-- Photos from americocigars.com. Idempotent; a product that does not exist is skipped.
do $$
declare r record;
begin
  for r in
    select p.id, v.path, v.alt
    from (values
      ('AMERICO-BIGFATHER-%', '/images/americo-big-father.jpg', 'Americo Big Father cigar with white and red band'),
      ('AMERICO-ANIVERSARIO-%', '/images/americo-aniversario.jpg', 'Americo Aniversario cigar with copper band'),
      ('AMERICO-DONLEO-%', '/images/americo-don-leo.jpg', 'Americo Don Leo Reserva Especial cigar with blue band'),
      ('AMERICO-PALMERA-%', '/images/americo-palmera.jpg', 'Americo Palmera Reserva cigar with teal band')
    ) as v(sku_like, path, alt)
    join products p on p.sku like v.sku_like
    where not exists (select 1 from product_images x where x.product_id = p.id and x.path = v.path)
  loop
    update product_images set position = position + 10 where product_id = r.id;
    insert into product_images (product_id, path, alt, position) values (r.id, r.path, r.alt, 0);
  end loop;
end $$;

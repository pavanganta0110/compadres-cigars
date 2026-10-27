-- Shipping weights (ounces, packed, rounded up). Checkout asks FedEx for rates by weight and fails closed when a product has none.
-- ESTIMATES: confirm with a scale and correct them in the admin portal. Only fills products that have no weight yet. Idempotent.
update products set weight_oz = case
  when sku like 'AMERICO-%' then 60                                   -- box of 20, wooden box
  when sku in ('LION-GRANCORONA-60X6-20','LION-DMTORO-52X6-20','LION-MADTORPEDO-52X6-20','LION-BELICOSO-50X525-20','LION-ROBUSTO-50X5-20') then 60
  when sku in ('LION-CARDINALBP-60X675-10','LION-CARDINALPF-60X6-10') then 36   -- box of 10, wooden box
  when sku = 'LION-SUAREZLANCERO-44X7-10' then 28
  when sku like 'LION-CIGARILLO-NATURAL-%' then 60                    -- box of 100
  when sku like 'LION-CIGARILLO-%' then 8                             -- box of 10
  when sku = 'ISLEY-PLUG-60X675-10' then 48
  when sku = 'SUGARHILL-RD-10' then 72 end
where weight_oz is null and sku in (
  select sku from products where sku like 'AMERICO-%' or sku like 'LION-%' or sku in ('ISLEY-PLUG-60X675-10','SUGARHILL-RD-10'));

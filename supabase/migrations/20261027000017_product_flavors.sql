-- Flavour dropdown: products that share a variant_group are shown as ONE product with a selector. Each flavour stays its own
-- product (own SKU, stock and price), so cart, checkout, tax and stock need no change. Idempotent.
alter table products add column if not exists variant_group text;
alter table products add column if not exists variant_label text;
update products set variant_group = 'Cigarillos — Box of 10',
  variant_label = case sku
    when 'LION-CIGARILLO-VANILLA-10' then 'Vanilla' when 'LION-CIGARILLO-CHERRY-10' then 'Cherry'
    when 'LION-CIGARILLO-COGNAC-10' then 'Cognac' when 'LION-CIGARILLO-CHOCOLATE-10' then 'Chocolate'
    when 'LION-CIGARILLO-ESPRESSO-10' then 'Espresso' when 'LION-CIGARILLO-VARIETY-10' then 'Variety' end
where sku in ('LION-CIGARILLO-VANILLA-10','LION-CIGARILLO-CHERRY-10','LION-CIGARILLO-COGNAC-10','LION-CIGARILLO-CHOCOLATE-10','LION-CIGARILLO-ESPRESSO-10','LION-CIGARILLO-VARIETY-10');

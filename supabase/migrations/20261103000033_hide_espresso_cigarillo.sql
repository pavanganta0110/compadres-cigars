-- Hide the Espresso cigarillo from the storefront (inactive products are not shown publicly; it can be turned back on in the admin). Idempotent.
update products set active = false where sku = 'LION-CIGARILLO-ESPRESSO-10';

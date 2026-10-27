-- Shipping weight for every product: 2.5 lb (40 oz), set by the owner. Checkout asks FedEx for rates by weight and fails closed
-- when a product has none. Correct individual products in the admin portal if a box weighs differently. Idempotent.
update products set weight_oz = 40;

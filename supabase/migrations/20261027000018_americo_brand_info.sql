-- Americo Cigars brand story and product details, taken from americocigars.com. Idempotent; a no-op if the brand does not exist.
-- Wrapper and sizes stay as on the owner's price list. Binder and filler are not published, so they stay empty.
update brands set
  tagline = 'A legacy meant to be savored, never rushed.',
  short_description = 'Handmade premium Dominican cigars from Villa Gonzalez, Santiago. Born from a name. Made to endure.',
  story = E'Americo Cigars makes premium handmade cigars in Villa Gonzalez, Santiago, in the Dominican Republic, the world''s largest producer of premium handmade cigars. The Cibao valley''s soil and climate have given the region a tobacco tradition passed down through generations.\n\nThe company was founded in 2021 by Don Americo Ortiz. His son, baseball legend David Ortiz, now owns it and carries on the family legacy. Master artisans with more than 25 years of experience hand-select the leaves, cure them without hurry, and roll each cigar as both craft and art.\n\nAmerico Cigars is served in more than 100 hotels, restaurants, cigar lounges and liquor stores across the United States, Puerto Rico and the Dominican Republic. The mission is simple: make the finest cigars, using methods that ensure premium quality.'
where slug = 'americo-cigars';

update products set strength = 'mild-medium', flavor_profile = 'Almond, cocoa, coffee', country_of_origin = 'Dominican Republic',
  description = 'Big Father, where the ritual begins. A sweet and savory opening with dried-fruit almond, cocoa and a hint of bitter coffee, becoming creamier with almond, walnut and a lingering cocoa and chocolate sweetness. Pairs with a latte, cortado or black tea, in the early hours of the day. Handmade in Villa Gonzalez, Santiago; final blend details may vary by harvest. Sold by the box only.'
where sku like 'AMERICO-BIGFATHER-%';
update products set strength = 'medium', flavor_profile = 'Coffee, walnut, cinnamon', country_of_origin = 'Dominican Republic',
  description = 'Aniversario, the first blend from the Americo factory. A cold draw that hints at aged leaves, roasted coffee, walnut-like dried fruit and a subtle cinnamon spice, becoming creamier as it smokes, with good construction and combustion. Pairs with aged rum, espresso or cognac, for celebrations and toasts. Handmade in Villa Gonzalez, Santiago; final blend details may vary by harvest. Sold by the box only.'
where sku like 'AMERICO-ANIVERSARIO-%';
update products set strength = 'medium', flavor_profile = 'Cocoa, coffee, almond', country_of_origin = 'Dominican Republic',
  description = 'Don Leo Reserva Especial. Roasted coffee aromas, cocoa flavors and dried-fruit notes of almond and walnut, creamier as you smoke, with a dense aromatic smoke, a compact light gray ash and an exceptional draw. Pairs with dark rum, dark chocolate or bold coffee, after dinner. Handmade in Villa Gonzalez, Santiago; final blend details may vary by harvest. Sold by the box only.'
where sku like 'AMERICO-DONLEO-%';
update products set strength = 'medium-full', flavor_profile = 'Pepper, leather, walnut', country_of_origin = 'Dominican Republic',
  description = 'Palmera Reserva. A dark brown, slightly oily, very smooth wrapper over a creamy tobacco character with spicy pepper, a touch of leather, walnut-like dried fruit and a subtle cinnamon hint. Pairs with whisky, brandy or black coffee, for late afternoon and reflection. Handmade in Villa Gonzalez, Santiago; final blend details may vary by harvest. Sold by the box only.'
where sku like 'AMERICO-PALMERA-%';

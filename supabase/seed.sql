-- Phase 1 seed: two real products with PLACEHOLDER prices/stock (placeholder_price = true).
-- Unknown cigar specs (wrapper/binder/filler/strength) are left null on purpose; do not invent them.
insert into brands (slug, name, tagline, short_description, story, logo_path, hero_path, accent_color, template, display_order) values
('ronald-isley', 'Ronald Isley', 'The Gold Standard',
 'Legendary music. Timeless taste. A premium Dominican cigar by Ronald Isley.',
 E'For more than six decades, Ronald Isley has defined excellence in music, style, and culture. His unmistakable voice, timeless hits, and influence on generations have made him a true icon.\n\nThe Plug cigar is an extension of that legacy. A smooth, refined smoke for those who appreciate the finer things in life and move with purpose.',
 '/images/crest.png', '/images/isley-box-open.jpg', '#d6ad68', 'isley', 10),
('sugarhill', 'Sugarhill', 'Rapper''s Delight',
 'Handcrafted Dominican cigars with hip-hop roots, sold by the box.',
 E'Draft copy, pending client approval.\n\nSugarhill is where the records meet the rolling room: bold, loud, and made to be shared. Rapper''s Delight is the first release.',
 '/images/crest.png', '/images/sugarhill-box-open.jpg', '#e0457b', 'sugarhill', 20);

insert into products (brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity,
  vitola, length_in, ring_gauge, country_of_origin, weight_oz) values
((select id from brands where slug='ronald-isley'), 'the-plug-box-of-10', 'ISLEY-PLUG-60X675-10',
 'Ronald Isley "The Plug" — Box of 10',
 'Belicoso, 60 x 6.75. Box of 10. Handcrafted in the Dominican Republic.',
 'Expertly crafted in the Dominican Republic by Compadres Cigars, The Plug delivers a premium smoking experience worthy of the name. Rich flavor, smooth draw, and a bold presence, just like the music. Sold by the box only.',
 14900, 25, 10, 'Belicoso', 6.75, 60, 'Dominican Republic', null),
((select id from brands where slug='sugarhill'), 'rappers-delight-box-of-10', 'SUGARHILL-RD-10',
 'Sugarhill "Rapper''s Delight" — Box of 10',
 'Box of 10. Handcrafted in the Dominican Republic.',
 'Rapper''s Delight, the first Sugarhill release, presented in a lacquered black and gold humidor-style box. Sold by the box only.',
 12900, 25, 10, null, null, null, 'Dominican Republic', null);

insert into product_images (product_id, path, alt, position) values
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-box-open.jpg', 'Open box of ten Ronald Isley The Plug cigars', 0),
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-cigar.jpg', 'A single Ronald Isley The Plug belicoso cigar', 1),
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-box-spine.jpg', 'Box spine reading 10 Cigars, The Plug, 60 x 6.75', 2),
((select id from products where sku='SUGARHILL-RD-10'), '/images/sugarhill-box-closed.jpg', 'Closed black and gold Rapper''s Delight cigar box', 0),
((select id from products where sku='SUGARHILL-RD-10'), '/images/sugarhill-box-open.jpg', 'Open Rapper''s Delight box showing ten cigars', 1);

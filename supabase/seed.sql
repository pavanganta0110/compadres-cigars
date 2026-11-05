-- Phase 1 seed: two real products with PLACEHOLDER prices/stock (placeholder_price = true).
-- Unknown cigar specs (wrapper/binder/filler/strength) are left null on purpose; do not invent them.
insert into brands (slug, name, tagline, short_description, story, logo_path, hero_path, accent_color, template, display_order) values
('ronald-isley', 'Ronald Isley', 'The Gold Standard',
 'Legendary music. Timeless taste. A premium Dominican cigar by Ronald Isley.',
 E'For more than six decades, Ronald Isley has defined excellence in music, style, and culture. His unmistakable voice, timeless hits, and influence on generations have made him a true icon.\n\nBorn in Cincinnati, Ohio, on May 21, 1941, Ronald is the lead voice and a founding member of The Isley Brothers. The group''s debut single, “Shout,” arrived in 1959, and over the decades his smooth tenor carried soul, funk and R&B through the T-Neck Records years and the landmark 3 + 3 album of 1973.\n\nThe honors followed. The Isley Brothers entered the Rock and Roll Hall of Fame in 1992. He joined Rod Stewart on a top-ten version of “This Old Heart of Mine” in 1990, teamed up with Burt Bacharach on Here I Am in 2003, and stepped out on his own in 2010 with his first solo album, Mr. I. In 2016, Berklee College of Music awarded him an honorary doctorate of music.\n\nThe Plug cigar is an extension of that legacy. A smooth, refined smoke for those who appreciate the finer things in life and move with purpose.',
 '/images/crest.png', '/images/isley-portrait-white-suit.jpg', '#d6ad68', 'isley', 10),
('sugarhill', 'Sugarhill', 'Rapper''s Delight',
 'Handcrafted Dominican cigars with hip-hop roots, sold by the box.',
 E'In 1979, in Englewood, New Jersey, a producer put three young MCs in a studio and changed popular music. “Rapper''s Delight” by the Sugarhill Gang became the first rap single to reach the top 40 of the Billboard Hot 100, peaking at number 36 in January 1980, and it is now counted among the most important rap songs ever recorded.\n\nThe group was assembled by Sylvia Robinson, co-founder of Sugar Hill Records, with Henry “Big Bank Hank” Jackson, Michael “Wonder Mike” Wright and Guy “Master Gee” O''Brien. Both the group and the label take their name from the Sugar Hill neighborhood of Harlem. “Apache” and “8th Wonder” followed, the group reformed in 1994, and in 2019 it marked the 40th anniversary of “Rapper''s Delight” with a world tour.\n\nSugarhill cigars bring that story to the humidor: bold, loud, and made to be shared. Rapper''s Delight is the first release.',
 '/images/crest.png', '/images/sugarhill-box-open.jpg', '#e0457b', 'sugarhill', 20);

insert into products (brand_id, slug, sku, name, short_description, description, price_cents, stock, box_quantity,
  vitola, length_in, ring_gauge, country_of_origin, weight_oz) values
((select id from brands where slug='ronald-isley'), 'the-plug-box-of-10', 'ISLEY-PLUG-60X675-10',
 'Ronald Isley "The Plug" — Box of 10',
 'Box Press Torpedo, 60 x 6.75. Box of 10. Handcrafted in the Dominican Republic.',
 'Expertly crafted in the Dominican Republic by Lion Cigars, The Plug delivers a premium smoking experience worthy of the name. Rich flavor, smooth draw, and a bold presence, just like the music. Sold by the box only.',
 42999, 25, 10, 'Box Press Torpedo', 6.75, 60, 'Dominican Republic', null),
((select id from brands where slug='sugarhill'), 'rappers-delight-box-of-10', 'SUGARHILL-RD-10',
 'Sugarhill "Rapper''s Delight" — Box of 20',
 'Box of 20, 60 x 6, Habano wrapper. Handcrafted in the Dominican Republic.',
 'Rapper''s Delight, the first Sugarhill release, presented in a lacquered black and gold humidor-style box. Sold by the box only.',
 34999, 25, 20, null, 6, 60, 'Dominican Republic', null);

insert into product_images (product_id, path, alt, position) values
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-open-box.jpg', 'Open box of ten Ronald Isley The Plug cigars with the gold Gold Standard seal', 0),
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-box-and-cigar-clean.jpg', 'Ronald Isley The Plug open box with a single cigar and the closed black box', 1),
((select id from products where sku='ISLEY-PLUG-60X675-10'), '/images/isley-cigar-standing.jpg', 'A single Ronald Isley The Plug belicoso cigar with its gold and black bands', 2),
((select id from products where sku='SUGARHILL-RD-10'), '/images/sugarhill-box-closed.jpg', 'Closed black and gold Rapper''s Delight cigar box', 0),
((select id from products where sku='SUGARHILL-RD-10'), '/images/sugarhill-box-open.jpg', 'Open Rapper''s Delight box showing ten cigars', 1);

-- Prices on the owner's price list are approved (not placeholders).
update products set placeholder_price = false where sku in ('ISLEY-PLUG-60X675-10','SUGARHILL-RD-10');

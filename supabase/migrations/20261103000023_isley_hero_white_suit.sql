-- Ronald Isley: the brand banner becomes the white-suit portrait.
-- Idempotent, and it only replaces the previous default banner so a banner uploaded in the admin is left alone.
update brands set hero_path = '/images/isley-portrait-white-suit.jpg'
where slug = 'ronald-isley' and hero_path = '/images/isley-lounge.jpg';

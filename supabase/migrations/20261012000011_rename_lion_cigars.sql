-- The business is Lion Cigars (it was drafted under a placeholder name). Update stored customer-facing copy; idempotent.
update products set
  name = replace(name, 'Compadres Cigars', 'Lion Cigars'),
  short_description = replace(short_description, 'Compadres Cigars', 'Lion Cigars'),
  description = replace(description, 'Compadres Cigars', 'Lion Cigars')
where name like '%Compadres%' or short_description like '%Compadres%' or description like '%Compadres%';
update brands set
  name = replace(name, 'Compadres Cigars', 'Lion Cigars'),
  tagline = replace(tagline, 'Compadres Cigars', 'Lion Cigars'),
  short_description = replace(short_description, 'Compadres Cigars', 'Lion Cigars'),
  story = replace(story, 'Compadres Cigars', 'Lion Cigars')
where name like '%Compadres%' or tagline like '%Compadres%' or short_description like '%Compadres%' or story like '%Compadres%';

-- New brand: Jet Smoke Cigars (from jetsmokecigars.com). Its Signature Collection is still "coming soon", so there are no products yet. Idempotent.
insert into brands (slug, name, tagline, short_description, story, logo_path, hero_path, accent_color, template, display_order)
select 'jet-smoke-cigars', 'Jet Smoke Cigars', 'Premium Cigars for Champions',
  'Premium cigars led by former NBA champion Jason “The Jet” Terry and Cyrus Rodgers. The Signature Collection is coming soon.',
  E'Jet Smoke Cigars is led by former NBA champion Jason “The Jet” Terry and Cyrus Rodgers, and it is built on one idea: earned, not given. Every blend celebrates hard work, achievement and legacy, for the people who show out when it matters.\n\nThe Signature Collection is coming soon, with three blends: Draft Pick, a smooth, classic Connecticut; 6th Man, a reliable, balanced Habano with clutch flavor; and Queens Court, sweet-tipped elegance with notes of vanilla and honey.',
  null, null, '#d6ad68', 'default', 50
where not exists (select 1 from brands where slug = 'jet-smoke-cigars');

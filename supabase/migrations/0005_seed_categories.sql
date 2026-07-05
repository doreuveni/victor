-- ============================================================================
-- 0005_seed_categories.sql — Fixed Hebrew category taxonomy
-- Idempotent: safe to re-run.
-- ============================================================================

insert into public.categories (slug, name_he, position) values
  ('breakfast',   'ארוחת בוקר',   10),
  ('main',        'מנות עיקריות',  20),
  ('side',        'תוספות',        30),
  ('soup',        'מרקים',         40),
  ('salad',       'סלטים',         50),
  ('bread',       'לחמים ומאפים',  60),
  ('pastry',      'מאפים מתוקים',  70),
  ('dessert',     'קינוחים',       80),
  ('cake',        'עוגות',         90),
  ('cookies',     'עוגיות',       100),
  ('vegetarian',  'צמחוני',       110),
  ('vegan',       'טבעוני',       120),
  ('meat',        'בשרי',         130),
  ('chicken',     'עוף',          140),
  ('fish',        'דגים',         150),
  ('dairy',       'חלבי',         160),
  ('pasta',       'פסטה',         170),
  ('rice',        'אורז ודגנים',  180),
  ('sauce',       'רטבים',        190),
  ('drink',       'משקאות',       200),
  ('snack',       'חטיפים',       210),
  ('holiday',     'חגים',         220),
  ('kids',        'לילדים',       230),
  ('quick',       'מהיר וקל',     240),
  ('ferment',     'התססות',       250)
on conflict (slug) do update
  set name_he = excluded.name_he, position = excluded.position;

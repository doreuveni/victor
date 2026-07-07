-- ============================================================================
-- 0018_search_relevance.sql — Weighted relevance ranking for recipe search,
-- with Hebrew final-letter (sofit) normalization so plural/variant word forms
-- match (e.g. "צנון" query matching "צנונית" in an ingredient line — the
-- singular's final-nun ן only differs from the plural's regular-nun נ because
-- it's no longer word-final; without normalizing that, they never overlap).
--
-- Score = weighted sum of word_similarity() per field (title heaviest,
-- then category, then caption, then ingredients — a title match should
-- outrank an ingredient-only match) plus a flat bonus for an exact ILIKE
-- substring hit in that field, so every match the old plain-ILIKE search
-- caught is still caught (score comfortably clears the threshold), on top of
-- the new fuzzy/variant matches word_similarity adds.
--
-- Switches search_recipes from keyset (created_at, id) to offset pagination:
-- relevance score isn't part of any indexed column, so a keyset cursor can't
-- be built from it — offset is the honest, simple option here, and fine at
-- this app's scale. Old 4-arg signature is dropped explicitly (changing a
-- function's argument list isn't something CREATE OR REPLACE can do — it
-- would just create a second overload and leave the old one lingering).
-- ============================================================================

create or replace function public.normalize_hebrew_finals(t text)
returns text
language sql immutable
set search_path = ''
as $$
  select translate(coalesce(t, ''), 'ךםןףץ', 'כמנפצ');
$$;

drop function if exists public.search_recipes(text, timestamptz, uuid, int);

create or replace function public.search_recipes(
  p_query  text,
  p_offset int default 0,
  p_limit  int default 12
) returns setof public.feed_card
language sql stable
set search_path = ''
as $$
  with scored as (
    select
      r.id, r.title, r.cover_url, r.caption, r.created_at,
      p.id as author_id, p.username, p.display_name, p.avatar_url,
      coalesce(s.like_count, 0) as like_count,
      coalesce(s.comment_count, 0) as comment_count,
      c.name_he,
      (
        public.word_similarity(public.normalize_hebrew_finals(p_query), public.normalize_hebrew_finals(r.title)) * 4.0
        + (case when r.title ilike '%' || p_query || '%' then 3.0 else 0 end)
        + public.word_similarity(public.normalize_hebrew_finals(p_query), public.normalize_hebrew_finals(coalesce(c.name_he, ''))) * 2.0
        + (case when c.name_he ilike '%' || p_query || '%' then 1.5 else 0 end)
        + public.word_similarity(public.normalize_hebrew_finals(p_query), public.normalize_hebrew_finals(coalesce(r.caption, ''))) * 1.0
        + (case when r.caption ilike '%' || p_query || '%' then 0.75 else 0 end)
        + coalesce((
            select max(
              public.word_similarity(public.normalize_hebrew_finals(p_query), public.normalize_hebrew_finals(ii.text)) * 1.0
              + (case when ii.text ilike '%' || p_query || '%' then 0.75 else 0 end)
            )
            from public.ingredient_sections isec
            join public.ingredient_items ii on ii.section_id = isec.id
            where isec.recipe_id = r.id
          ), 0)
      ) as relevance
    from public.recipes r
    join public.profiles p on p.id = r.author_id
    left join public.recipe_stats s on s.recipe_id = r.id
    left join public.categories c on c.id = r.category_id
    where r.status = 'published'
      and r.is_public = true
      and trim(p_query) <> ''
  )
  select id, title, cover_url, caption, created_at,
         author_id, username, display_name, avatar_url,
         like_count, comment_count, name_he
  from scored
  where relevance > 0.12
  order by relevance desc, created_at desc, id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_recipes(text, int, int) to authenticated;

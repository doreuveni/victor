-- ============================================================================
-- 0014_search.sql — Dedicated search: recipes (title/caption/category/
-- ingredients) and people (username/display_name).
-- Trigram indexes mirror the existing recipes_title_trgm_idx pattern (0001) —
-- same reasoning: no Hebrew dictionary for native FTS, ILIKE + gin_trgm_ops
-- already proven for title search, so it's extended rather than replaced.
-- ============================================================================

create index if not exists ingredient_items_text_trgm_idx on public.ingredient_items using gin (text gin_trgm_ops);
create index if not exists profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (display_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- search_recipes(query) — title, caption, category name, or any ingredient
-- line. EXISTS (not a join) against ingredient_sections/items so a recipe
-- with several matching ingredient lines still returns exactly one row —
-- keyset pagination on (created_at, id) stays correct either way.
-- ---------------------------------------------------------------------------
create or replace function public.search_recipes(
  p_query          text,
  p_cursor_created timestamptz default null,
  p_cursor_id      uuid        default null,
  p_limit          int         default 12
) returns setof public.feed_card
language sql stable
set search_path = ''
as $$
  select r.id, r.title, r.cover_url, r.caption, r.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         coalesce(s.like_count, 0), coalesce(s.comment_count, 0),
         c.name_he
  from public.recipes r
  join public.profiles p on p.id = r.author_id
  left join public.recipe_stats s on s.recipe_id = r.id
  left join public.categories c on c.id = r.category_id
  where r.status = 'published'
    and r.is_public = true
    and trim(p_query) <> ''
    and (
      r.title ilike '%' || p_query || '%'
      or r.caption ilike '%' || p_query || '%'
      or c.name_he ilike '%' || p_query || '%'
      or exists (
        select 1
        from public.ingredient_sections isec
        join public.ingredient_items ii on ii.section_id = isec.id
        where isec.recipe_id = r.id and ii.text ilike '%' || p_query || '%'
      )
    )
    and (
      p_cursor_created is null
      or (r.created_at, r.id) < (p_cursor_created, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.search_recipes(text, timestamptz, uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- search_profiles(query) — username or display name. No keyset pagination:
-- capped top-N by a simple relevance heuristic (exact/prefix username match
-- first, then follower count) rather than an infinite list.
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_query text, p_limit int default 20)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
  followers_count int,
  is_following    boolean
)
language sql stable
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url,
    (select count(*) from public.follows f where f.followee_id = p.id)::int,
    coalesce(auth.uid() is not null and exists(
      select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id
    ), false)
  from public.profiles p
  where p.username is not null
    and trim(p_query) <> ''
    and (p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
  order by
    (p.username ilike p_query || '%') desc, -- prefix match first
    (select count(*) from public.follows f where f.followee_id = p.id) desc,
    p.username
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.search_profiles(text, int) to authenticated;

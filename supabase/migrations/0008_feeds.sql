-- ============================================================================
-- 0008_feeds.sql — Feed RPCs (explore + following) with keyset pagination
-- SECURITY INVOKER (default for SQL functions): RLS on recipes/stats still
-- applies, so these can only ever return rows the caller may see. Keyset
-- pagination uses the (created_at desc, id desc) tuple to match recipes_feed_idx
-- and stay stable as new recipes are inserted.
-- ============================================================================

-- Shared card shape returned by both feeds.
create type public.feed_card as (
  id                  uuid,
  title               text,
  cover_url           text,
  caption             text,
  created_at          timestamptz,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_avatar_url   text,
  like_count          int,
  comment_count       int,
  category_name       text
);

-- ---------------------------------------------------------------------------
-- feed_explore — all public, published recipes, newest first.
-- Optional free-text title search (pg_trgm-backed ilike) and category filter.
-- Pass the last row's (created_at, id) as the cursor to page.
-- ---------------------------------------------------------------------------
create or replace function public.feed_explore(
  p_cursor_created timestamptz default null,
  p_cursor_id      uuid        default null,
  p_limit          int         default 12,
  p_search         text        default null,
  p_category       uuid        default null
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
    and (p_category is null or r.category_id = p_category)
    and (p_search is null or trim(p_search) = '' or r.title ilike '%' || p_search || '%')
    and (
      p_cursor_created is null
      or (r.created_at, r.id) < (p_cursor_created, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- feed_following — public, published recipes from users the caller follows.
-- ---------------------------------------------------------------------------
create or replace function public.feed_following(
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
  join public.follows f
    on f.followee_id = r.author_id and f.follower_id = auth.uid()
  join public.profiles p on p.id = r.author_id
  left join public.recipe_stats s on s.recipe_id = r.id
  left join public.categories c on c.id = r.category_id
  where r.status = 'published'
    and r.is_public = true
    and (
      p_cursor_created is null
      or (r.created_at, r.id) < (p_cursor_created, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.feed_explore(timestamptz, uuid, int, text, uuid) to authenticated;
grant execute on function public.feed_following(timestamptz, uuid, int) to authenticated;

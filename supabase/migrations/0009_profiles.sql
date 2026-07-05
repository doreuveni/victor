-- ============================================================================
-- 0009_profiles.sql — Profile page RPCs (counts + follow state + recipe list)
-- Both SECURITY INVOKER: profiles/follows are public-read (RLS using(true)),
-- and recipe visibility still goes through can_view_recipe / recipes RLS, so
-- these can't leak anything a direct client query couldn't already see.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- get_profile(username) — header data for the profile page.
-- recipe_count uses can_view_recipe so an owner viewing their own profile also
-- sees their private recipes counted; everyone else only sees public ones.
-- ---------------------------------------------------------------------------
create or replace function public.get_profile(p_username text)
returns table (
  id               uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  created_at       timestamptz,
  followers_count  int,
  following_count  int,
  recipe_count     int,
  is_following     boolean,
  is_self          boolean
)
language sql stable
set search_path = ''
as $$
  select
    p.id, p.username, p.display_name, p.avatar_url, p.created_at,
    (select count(*) from public.follows f where f.followee_id = p.id)::int,
    (select count(*) from public.follows f where f.follower_id = p.id)::int,
    (select count(*) from public.recipes r
       where r.author_id = p.id and public.can_view_recipe(r.id))::int,
    coalesce(auth.uid() is not null and exists(
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.followee_id = p.id
    ), false),
    p.id = auth.uid()
  from public.profiles p
  where lower(p.username) = lower(p_username);
$$;

grant execute on function public.get_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- profile_recipes(username, cursor, limit) — that user's recipes, keyset-paged.
-- Reuses the feed_card type from 0008_feeds.sql. RLS on recipes still gates
-- visibility, so a stranger only ever gets that author's public+published rows;
-- the author themself (or admin) also sees their own private/draft ones.
-- ---------------------------------------------------------------------------
create or replace function public.profile_recipes(
  p_username       text,
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
  where lower(p.username) = lower(p_username)
    and (
      p_cursor_created is null
      or (r.created_at, r.id) < (p_cursor_created, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.profile_recipes(text, timestamptz, uuid, int) to authenticated;

-- ============================================================================
-- 0013_profile_bio.sql — Editable profile: bio field
-- display_name/avatar_url were already self-editable via the existing
-- profiles_update RLS policy (0004); bio rides the same policy for free.
-- get_profile (0009) is recreated to include it in the header payload.
-- ============================================================================

alter table public.profiles add column if not exists bio text;

-- Adding a column to the returned row changes the function's OUT signature,
-- which CREATE OR REPLACE can't do in place — Postgres requires a drop first.
drop function if exists public.get_profile(text);

create function public.get_profile(p_username text)
returns table (
  id               uuid,
  username         text,
  display_name     text,
  avatar_url       text,
  bio              text,
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
    p.id, p.username, p.display_name, p.avatar_url, p.bio, p.created_at,
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

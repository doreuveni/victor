-- ============================================================================
-- 0012_admin.sql — Moderation: ban flag + admin report queue RPC
-- "Unpublish a recipe" and "delete a reported comment" need no new SQL:
-- recipes_update/recipes_delete and comments_delete already grant admins
-- write access (0004). This migration adds the one moderation action that
-- didn't exist yet — banning a user — plus a read RPC for the admin queue.
-- ============================================================================

alter table public.profiles add column is_banned boolean not null default false;

-- ---------------------------------------------------------------------------
-- is_banned_self() — cheap self-lookup used to block a banned user's own
-- writes at the database layer (defense in depth beyond just hiding them).
-- ---------------------------------------------------------------------------
create or replace function public.is_banned_self()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Hide a banned author's public content from everyone except themself/admin.
-- Mirrors the existing duplicated-logic pattern: can_view_recipe (SECURITY
-- DEFINER, used by child tables) and the recipes_select RLS policy must both
-- carry the same rule, exactly as they already both carry is_public/status.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_recipe(rid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.recipes r
    join public.profiles au on au.id = r.author_id
    where r.id = rid
      and (
        (r.is_public and r.status = 'published' and not au.is_banned)
        or r.author_id = auth.uid()
        or public.is_admin()
      )
  );
$$;

drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes for select using (
  (is_public and status = 'published'
    and not exists (select 1 from public.profiles au where au.id = author_id and au.is_banned))
  or author_id = auth.uid()
  or public.is_admin()
);

-- A banned user's comments disappear too, even on recipes others can see.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (
  public.can_view_recipe(recipe_id)
  and (
    author_id = auth.uid()
    or public.is_admin()
    or not exists (select 1 from public.profiles cp where cp.id = author_id and cp.is_banned)
  )
);

-- ---------------------------------------------------------------------------
-- Defense in depth: a banned user can't create new recipes/comments/likes/
-- follows even if they still hold a valid session (their existing rows are
-- just hidden by the SELECT policies above; this stops new abuse outright).
-- ---------------------------------------------------------------------------
drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes for insert
  with check (author_id = auth.uid() and not public.is_banned_self());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (author_id = auth.uid() and public.can_view_recipe(recipe_id) and not public.is_banned_self());

drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert
  with check (user_id = auth.uid() and public.can_view_recipe(recipe_id) and not public.is_banned_self());

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert
  with check (follower_id = auth.uid() and not public.is_banned_self());

-- ---------------------------------------------------------------------------
-- admin_set_banned(user_id, banned) — the only way to flip is_banned. An RPC
-- rather than a permissive RLS policy so an admin's power is scoped to
-- exactly this one column/action, not arbitrary writes to other profiles.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles set is_banned = p_banned where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_reports() — open reports with a resolved, human-readable preview of
-- whatever was reported. SECURITY INVOKER: reports_admin_select already
-- restricts the base table to admins, so a non-admin caller gets zero rows.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reports()
returns table (
  id                      uuid,
  target_type             report_target,
  target_id               uuid,
  reason                  text,
  status                  report_status,
  created_at              timestamptz,
  reporter_username       text,
  recipe_id               uuid,
  recipe_title            text,
  recipe_author_username  text,
  recipe_is_public        boolean,
  comment_body            text,
  comment_recipe_id       uuid,
  comment_author_username text,
  profile_username        text,
  profile_is_banned       boolean
)
language sql stable
set search_path = ''
as $$
  select
    r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
    rp.username,
    rec.id, rec.title, recauth.username, rec.is_public,
    c.body, c.recipe_id, cauth.username,
    tp.username, tp.is_banned
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.recipes rec on r.target_type = 'recipe' and rec.id = r.target_id
  left join public.profiles recauth on recauth.id = rec.author_id
  left join public.comments c on r.target_type = 'comment' and c.id = r.target_id
  left join public.profiles cauth on cauth.id = c.author_id
  left join public.profiles tp on r.target_type = 'profile' and tp.id = r.target_id
  where r.status = 'open'
  order by r.created_at desc;
$$;

grant execute on function public.admin_reports() to authenticated;

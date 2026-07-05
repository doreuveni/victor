-- ============================================================================
-- 0002_functions.sql — Helper + trigger functions
-- All SECURITY DEFINER functions pin an empty search_path and fully-qualify
-- every object, so they can't be hijacked by a malicious search_path and they
-- bypass RLS internally (owned by a privileged role) — which is exactly what
-- lets can_view_recipe() be reused inside child-table policies without
-- recursion.
-- ============================================================================

-- ---------- is_admin() -----------------------------------------------------
-- Admin is a table lookup, never a JWT claim the user can forge.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------- can_view_recipe(rid) -------------------------------------------
-- THE single source of truth for recipe visibility. Reused in the SELECT
-- policy of every recipe child table so private recipes can never leak
-- through ingredients / steps / photos.
create or replace function public.can_view_recipe(rid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.recipes r
    where r.id = rid
      and (
        (r.is_public and r.status = 'published')
        or r.author_id = auth.uid()          -- owner sees own drafts + private
        or public.is_admin()
      )
  );
$$;

-- ---------- owns_recipe(rid) — write guard for child tables ----------------
create or replace function public.owns_recipe(rid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = rid and (r.author_id = auth.uid() or public.is_admin())
  );
$$;

-- ===========================================================================
-- TRIGGER FUNCTIONS
-- ===========================================================================

-- ---------- New auth user -> profile row -----------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- ---------- Username: immutable once set -----------------------------------
create or replace function public.protect_username()
returns trigger
language plpgsql
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username is immutable once set';
  end if;
  return new;
end;
$$;

-- ---------- On username first-set: create the default "נשמרו" board --------
create or replace function public.create_default_collection()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.username is null and new.username is not null then
    insert into public.collections (owner_id, name, is_default, is_public)
    values (new.id, 'נשמרו', true, false)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- ---------- Recipe: create stats row on insert -----------------------------
create or replace function public.recipe_after_insert_stats()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.recipe_stats (recipe_id) values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

-- ---------- Recipe: stamp published_at + updated_at (BEFORE) ---------------
create or replace function public.recipe_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- author_id is immutable
  if tg_op = 'UPDATE' and new.author_id is distinct from old.author_id then
    raise exception 'author_id is immutable';
  end if;
  -- First transition into published stamps published_at exactly once.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

-- ---------- Recipe: fan-out "new_post" to followers on FIRST publish -------
create or replace function public.recipe_after_publish_fanout()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and new.is_public
     and (tg_op = 'INSERT' or old.published_at is null) then
    insert into public.notifications (recipient_id, type, actor_id, recipe_id)
    select f.follower_id, 'new_post', new.author_id, new.id
    from public.follows f
    where f.followee_id = new.author_id;
  end if;
  return new;
end;
$$;

-- ---------- Likes: maintain count + notify author --------------------------
create or replace function public.likes_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_author uuid;
begin
  update public.recipe_stats set like_count = like_count + 1 where recipe_id = new.recipe_id;
  select author_id into v_author from public.recipes where id = new.recipe_id;
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (recipient_id, type, actor_id, recipe_id)
    values (v_author, 'like', new.user_id, new.recipe_id);
  end if;
  return new;
end;
$$;

create or replace function public.likes_after_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.recipe_stats set like_count = greatest(like_count - 1, 0)
  where recipe_id = old.recipe_id;
  return old;
end;
$$;

-- ---------- Comments: maintain count + notify author -----------------------
create or replace function public.comments_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_author uuid;
begin
  update public.recipe_stats set comment_count = comment_count + 1 where recipe_id = new.recipe_id;
  select author_id into v_author from public.recipes where id = new.recipe_id;
  if v_author is not null and v_author <> new.author_id then
    insert into public.notifications (recipient_id, type, actor_id, recipe_id, comment_id)
    values (v_author, 'comment', new.author_id, new.recipe_id, new.id);
  end if;
  return new;
end;
$$;

create or replace function public.comments_after_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.recipe_stats set comment_count = greatest(comment_count - 1, 0)
  where recipe_id = old.recipe_id;
  return old;
end;
$$;

-- ---------- Follows: notify followee ---------------------------------------
create or replace function public.follows_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, actor_id)
  values (new.followee_id, 'follow', new.follower_id);
  return new;
end;
$$;

-- ---------- Collection add: notify recipe author (public boards only) ------
create or replace function public.collection_items_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_author uuid; v_owner uuid; v_public boolean;
begin
  select owner_id, is_public into v_owner, v_public
    from public.collections where id = new.collection_id;
  select author_id into v_author from public.recipes where id = new.recipe_id;
  if v_public and v_author is not null and v_author <> v_owner then
    insert into public.notifications (recipient_id, type, actor_id, recipe_id)
    values (v_author, 'collection_add', v_owner, new.recipe_id);
  end if;
  return new;
end;
$$;

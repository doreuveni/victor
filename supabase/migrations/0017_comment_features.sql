-- ============================================================================
-- 0017_comment_features.sql — Comment replies, @mentions, comment likes
-- Adds one level of reply nesting (parent_comment_id), a comment_likes table
-- mirroring the existing recipe `likes` table, and @username mention
-- notifications parsed out of the comment body server-side. New enum values
-- are added before any function references them so this is safe whether
-- applied via the SQL Editor (statement-by-statement) or `supabase db push`
-- (whole file in one transaction) — a function body referencing a new enum
-- value isn't evaluated until it actually runs, well after this migration
-- commits.
-- ============================================================================

alter type notification_type add value if not exists 'mention';
alter type notification_type add value if not exists 'comment_like';

-- ---------- Replies (one level — replying to a reply attaches to its
-- top-level parent, same as Instagram) ---------------------------------------
alter table public.comments add column if not exists parent_comment_id uuid references public.comments (id) on delete cascade;
alter table public.comments add column if not exists like_count int not null default 0;
create index if not exists comments_parent_idx on public.comments (parent_comment_id);

-- ---------- Comment likes ----------------------------------------------------
create table if not exists public.comment_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select on public.comment_likes for select
  using (exists (
    select 1 from public.comments c where c.id = comment_id and public.can_view_recipe(c.recipe_id)
  ));

drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert on public.comment_likes for insert
  with check (
    user_id = auth.uid()
    and not public.is_banned_self()
    and exists (select 1 from public.comments c where c.id = comment_id and public.can_view_recipe(c.recipe_id))
  );

drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete on public.comment_likes for delete
  using (user_id = auth.uid());

-- ---------- Triggers: maintain comments.like_count + notify the comment author
create or replace function public.comment_likes_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_comment_author uuid;
begin
  update public.comments set like_count = like_count + 1 where id = new.comment_id;
  select author_id into v_comment_author from public.comments where id = new.comment_id;
  if v_comment_author is not null and v_comment_author <> new.user_id then
    insert into public.notifications (recipient_id, type, actor_id, comment_id, recipe_id)
    select v_comment_author, 'comment_like', new.user_id, new.comment_id, c.recipe_id
    from public.comments c where c.id = new.comment_id;
  end if;
  return new;
end;
$$;

create or replace function public.comment_likes_after_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  return old;
end;
$$;

drop trigger if exists comment_likes_ins on public.comment_likes;
create trigger comment_likes_ins after insert on public.comment_likes
  for each row execute function public.comment_likes_after_insert();

drop trigger if exists comment_likes_del on public.comment_likes;
create trigger comment_likes_del after delete on public.comment_likes
  for each row execute function public.comment_likes_after_delete();

-- ---------- @mentions: parsed out of the comment body on insert -------------
-- Extends the existing comments_after_insert trigger (0002) rather than
-- adding a second trigger, so both notifications are created in one pass.
create or replace function public.comments_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_author       uuid;
  v_handle       text;
  v_mentioned_id uuid;
begin
  update public.recipe_stats set comment_count = comment_count + 1 where recipe_id = new.recipe_id;
  select author_id into v_author from public.recipes where id = new.recipe_id;
  if v_author is not null and v_author <> new.author_id then
    insert into public.notifications (recipient_id, type, actor_id, recipe_id, comment_id)
    values (v_author, 'comment', new.author_id, new.recipe_id, new.id);
  end if;

  -- Usernames are always lowercase [a-z0-9_]{3,20} (enforced at onboarding);
  -- match case-insensitively since a comment might type @SomeOne.
  for v_handle in
    select distinct lower(m[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,20})', 'g') as m
  loop
    select id into v_mentioned_id from public.profiles where username = v_handle;
    if v_mentioned_id is not null and v_mentioned_id <> new.author_id then
      insert into public.notifications (recipient_id, type, actor_id, recipe_id, comment_id)
      values (v_mentioned_id, 'mention', new.author_id, new.recipe_id, new.id);
    end if;
  end loop;

  return new;
end;
$$;

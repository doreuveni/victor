-- ============================================================================
-- 0001_schema.sql — Extensions, enums, tables, indexes
-- Recipe Social. RTL/Hebrew-first social cookbook.
-- Ordering note: this file only creates structure. Functions (0002),
-- triggers (0003) and RLS policies (0004) come after, so everything they
-- reference already exists.
-- ============================================================================

create extension if not exists pg_trgm;      -- Hebrew search via trigram (no HE dictionary in FTS)
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- ---------- Enums ----------------------------------------------------------
create type recipe_status     as enum ('draft', 'published');
create type notification_type as enum ('follow', 'like', 'comment', 'collection_add', 'new_post');
create type report_target     as enum ('recipe', 'comment', 'profile');
create type report_status     as enum ('open', 'resolved', 'dismissed');

-- ---------- Profiles -------------------------------------------------------
-- One row per auth user. Created by trigger on signup (0003) with a NULL
-- username; the onboarding screen sets it exactly once (enforced in 0003).
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text,                                   -- NULL until onboarding; immutable once set
  display_name text,
  avatar_url   text,
  is_admin     boolean     not null default false,     -- server-only; never client-writable (see 0004)
  created_at   timestamptz not null default now()
);
-- Case-insensitive uniqueness. Multiple NULLs are allowed (pre-onboarding users).
create unique index profiles_username_lower_key on public.profiles (lower(username));

-- ---------- Categories (fixed admin taxonomy) ------------------------------
create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name_he  text not null,
  position int  not null default 0
);

-- ---------- Recipes --------------------------------------------------------
create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  caption      text,
  category_id  uuid references public.categories (id) on delete set null,
  prep_min     int,
  cook_min     int,
  servings     int,
  cover_url    text,
  status       recipe_status not null default 'draft',
  is_public    boolean       not null default true,
  published_at timestamptz,                              -- set on FIRST publish only; drives fan-out
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);
create index recipes_author_idx  on public.recipes (author_id);
create index recipes_category_idx on public.recipes (category_id);
-- Feed index: only visible, published, public recipes, newest first (keyset pagination).
create index recipes_feed_idx on public.recipes (created_at desc, id desc)
  where status = 'published' and is_public = true;
-- Hebrew search on title.
create index recipes_title_trgm_idx on public.recipes using gin (title gin_trgm_ops);

-- Denormalized counts live in a SEPARATE table with NO user-write policy, so
-- they can only be moved by SECURITY DEFINER triggers — nobody can forge them.
create table public.recipe_stats (
  recipe_id     uuid primary key references public.recipes (id) on delete cascade,
  like_count    int not null default 0,
  comment_count int not null default 0
);

-- ---------- Recipe children (all gated by can_view_recipe in 0004) ---------
create table public.recipe_photos (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  url       text not null,
  position  int  not null default 0
);
create index recipe_photos_recipe_idx on public.recipe_photos (recipe_id);

create table public.ingredient_sections (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name      text,                                        -- e.g. "לרוטב"; NULL = unnamed section
  position  int  not null default 0
);
create index ingredient_sections_recipe_idx on public.ingredient_sections (recipe_id);

create table public.ingredient_items (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.ingredient_sections (id) on delete cascade,
  text       text not null,                              -- free-text line, e.g. "2 כוסות קמח"
  position   int  not null default 0
);
create index ingredient_items_section_idx on public.ingredient_items (section_id);

create table public.instruction_steps (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  number    int  not null,
  text      text not null,
  photo_url text                                          -- optional inline step photo
);
create index instruction_steps_recipe_idx on public.instruction_steps (recipe_id);

-- ---------- Social graph ---------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)                      -- no self-follow
);
create index follows_followee_idx on public.follows (followee_id);
create index follows_follower_idx on public.follows (follower_id);

create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index likes_recipe_idx on public.likes (recipe_id);

-- ---------- Collections (boards) -------------------------------------------
create table public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  is_default boolean     not null default false,          -- the auto "נשמרו" board
  is_public  boolean     not null default true,
  created_at timestamptz not null default now()
);
create index collections_owner_idx on public.collections (owner_id);
-- Exactly one default board per user.
create unique index collections_one_default_per_owner on public.collections (owner_id)
  where is_default;

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  recipe_id     uuid not null references public.recipes (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);
create index collection_items_recipe_idx on public.collection_items (recipe_id);

-- ---------- Comments -------------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index comments_recipe_idx on public.comments (recipe_id, created_at);

-- ---------- Notifications --------------------------------------------------
-- Written ONLY by triggers (0003). No client INSERT policy (0004).
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         notification_type not null,
  actor_id     uuid references public.profiles (id) on delete cascade,
  recipe_id    uuid references public.recipes (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

-- ---------- Reports --------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type report_target not null,
  target_id   uuid not null,                              -- polymorphic; validated in app
  reason      text,
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

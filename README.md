# מתכונים — Recipe Social

A social personal cookbook, RTL/Hebrew-first. React + Vite + Tailwind on the
frontend, Supabase (Postgres + Google OAuth + Storage) on the backend.

## Status

- ✅ **Step 1 — Database:** schema, RLS, functions, triggers, seed. See
  [`supabase/README.md`](supabase/README.md). Verified on Postgres 14.
- ✅ **Step 2 — Auth + onboarding:** Google sign-in, mandatory one-time username
  claim (live availability check, race-safe, immutable once set).
- ✅ **Step 3 — RTL shell:** `dir="rtl"` Hebrew layout, bottom nav, header,
  auth/onboarding gate.
- ✅ **Step 4 — Upload wizard:** 5-step flow (תמונות → פרטים → מרכיבים → הוראות →
  תצוגה), server-side draft autosave, atomic publish via `publish_draft` RPC,
  HEIC→JPEG + compress + EXIF-strip pipeline, sectioned ingredients, per-step
  inline photos, public/private toggle. Needs migration `0007_drafts.sql`.
- ✅ **Step 5 — Recipe detail view:** `/r/:id` hero + gallery, author row, live
  like/comment counts, cooking-mode ingredient checkboxes (tap to strike through),
  numbered steps with inline photos. Private recipes 404 for non-owners (RLS).
  Publishing now lands on the new recipe.
- ✅ **Step 6 — Feeds:** Explore (all public recipes, title search + category
  filter) and Following feeds, keyset-paginated with infinite scroll via
  `feed_explore` / `feed_following` RPCs (SECURITY INVOKER — RLS still applies).
  Cards link to `/r/:id`. Needs migration `0008_feeds.sql`.
- ✅ **Step 7 — Profiles + follow:** `/u/:username` header (avatar, counts,
  follow/unfollow), `/me` redirects to caller's own profile, that user's
  recipe grid via `get_profile` / `profile_recipes` RPCs. Recipe count and
  recipe list still gated by `can_view_recipe` — strangers only ever see
  public+published rows, the owner sees everything. Needs migration
  `0009_profiles.sql`.
- ✅ **Step 8 — Likes, saves, collections:** real like/unlike (optimistic,
  live count) on recipe detail; save button opens a board picker (check/uncheck
  multiple boards, create new board inline); `/b/:id` board detail page via
  `collection_recipes` RPC; profile page gets a מתכונים/לוחות tab, boards grid
  shows item counts (public boards only for strangers, all for the owner).
  Needs migration `0010_collections.sql`.
- ✅ **Step 9 — Comments:** thread on recipe detail (post, list, delete),
  live comment count (optimistic, matches server trigger), delete allowed for
  comment author, recipe owner, or admin (existing RLS from step 1 — no new
  migration needed). Hebrew relative-time helper (`src/lib/time.ts`) shared
  with notifications next.
- ✅ **Step 10 — Notifications:** bell icon with live unread badge, dropdown
  panel (follow/like/comment/collection_add/new_post, Hebrew message per type,
  relative time, links to the recipe or actor profile), Realtime subscription
  on `notifications` INSERTs (RLS still scopes it to the caller's own rows —
  no separate check needed). Opening the panel marks everything read. Needs
  migration `0011_notifications_realtime.sql`.
- ✅ **Step 11 — Reporting + admin (final step):** report button (flag icon)
  on recipes, comments, and profiles → reason picker + optional note. Admin
  queue at `/admin` (shield icon in header, admins only) resolves each report
  to a human-readable preview and offers: hide recipe, delete comment,
  ban/unban user, dismiss, resolve. A banned user's public content disappears
  everywhere (feeds, profile, comments) while they still see it themselves;
  their new writes (recipes/comments/likes/follows) are blocked at the RLS
  layer too, and they get a lockout screen on next load. Needs migration
  `0012_admin.sql`.

All 11 steps of the build plan are now complete.

## Setup

### 1. Backend (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in order (`supabase db push`, or paste each file from
   `supabase/migrations/` into the SQL Editor).
3. **Auth → Providers → Google:** enable it, add your Google OAuth client
   ID/secret, and add `http://localhost:5173` (and your prod URL) to the
   redirect allow-list.
4. Make yourself admin once:
   ```sql
   update public.profiles set is_admin = true where username = 'your_username';
   ```

### 2. Frontend

```bash
cp .env.example .env      # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

> The app throws a clear error on boot if the `.env` vars are missing — that's
> intentional.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the built `dist/` |
| `npm run lint` | Typecheck only |

## RTL conventions

- `<html dir="rtl" lang="he">`; use Tailwind **logical** utilities
  (`ps/pe`, `ms/me`, `start/end`) so layout mirrors correctly.
- Wrap LTR islands (numbers, times, `@usernames`) in `<span class="ltr">` to stop
  bidi scrambling.

## Types note

The Supabase client is currently **untyped** (`createClient(...)`), with app-side
domain types in `src/lib/types.ts`. Once the project is linked, regenerate real
DB types and re-enable the typed client:

```bash
supabase gen types typescript --linked > src/lib/types.ts
# then switch src/lib/supabase.ts back to createClient<Database>(...)
```

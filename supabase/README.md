# Recipe Social — Database (Step 1)

Schema, RLS, functions, triggers, and seed for the Supabase backend.

## Files (apply in order)

| File | Purpose |
|------|---------|
| `migrations/0001_schema.sql` | Extensions, enums, tables, indexes |
| `migrations/0002_functions.sql` | Helper (`is_admin`, `can_view_recipe`, `owns_recipe`) + trigger functions |
| `migrations/0003_triggers.sql` | Wires triggers to tables |
| `migrations/0004_rls.sql` | Enables RLS + all policies |
| `migrations/0005_seed_categories.sql` | Fixed Hebrew category taxonomy (idempotent) |
| `migrations/0006_storage.sql` | Storage buckets + path-scoped policies |

## Apply

**Supabase CLI:** `supabase db push` (files run in filename order).
**Or** paste each file, in order, into the Supabase SQL Editor.

Then promote yourself to admin once:
```sql
update public.profiles set is_admin = true where username = 'your_username';
```

## Security model (the load-bearing decisions)

- **`can_view_recipe(rid)`** is the single source of truth for recipe visibility
  (`public+published` OR owner OR admin). It's reused in the SELECT policy of
  every recipe child table, so private recipes can't leak through
  ingredients / steps / photos / stats.
- **`collection_items`** SELECT requires the board visible **and** the recipe
  viewable — recipe privacy always beats board visibility.
- **`notifications`** have no INSERT policy; only SECURITY DEFINER triggers write
  them. Users can only read/mark-read/delete their own.
- **Counts** live in `recipe_stats` (no user write policy) — moved only by
  triggers, so they can't be forged.
- **Admin** is a table column read via `is_admin()`, never a JWT claim; users
  can't self-grant it.
- **Username** is set once (NULL → value) during onboarding and is immutable
  after (`protect_username` trigger). Setting it auto-creates the default
  "נשמרו" board.
- **Storage** buckets are public (unlisted, not secret — matches the agreed
  image-privacy decision). Writes are locked to each user's `{uid}/...` folder.

## Verified

All migrations apply cleanly on Postgres 14. A behavioral test suite (run under
a non-superuser role so RLS is enforced) confirmed:

- ✅ Private recipe's ingredients & stats invisible to other users
- ✅ Cannot forge a follow / like / notification as another user
- ✅ Cannot like a recipe you can't see
- ✅ Cannot read another user's notifications
- ✅ Username immutable once set; default board auto-created
- ✅ Cannot self-grant admin
- ✅ Cannot forge `like_count` (write is a no-op)
- ✅ Like/comment count triggers fire correctly
- ✅ New-post fan-out reaches followers on first publish only

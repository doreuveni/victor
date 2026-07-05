# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Victor** (מתכונים) — a Hebrew/RTL-first social recipe app. React + Vite + Tailwind frontend, Supabase (Postgres + RLS, Google OAuth, Storage) backend. No custom server — the client talks to Supabase directly; all authorization lives in Postgres RLS policies and SECURITY DEFINER RPCs, not in application code.

## Commands

```bash
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc --noEmit && vite build
npm run preview   # serve the built dist/
npm run lint      # tsc --noEmit (there is no separate lint tool — this IS the lint step)
```

There is no test suite/runner in this repo (no vitest/jest, no `*.test.*` files). Correctness is verified via `tsc --noEmit`, a production build, and manual/browser checks — don't invent a `npm test` command.

### Database

Schema lives in `supabase/migrations/*.sql`, applied in filename order via `supabase db push` or by pasting each file into the Supabase SQL Editor (see `supabase/README.md`). There's no migration-running CI — changes are applied manually against the linked project.

Two recurring Postgres gotchas hit in this repo, worth remembering when writing new migrations:
- `CREATE OR REPLACE FUNCTION` **cannot** change a function's `RETURNS TABLE(...)` column signature — adding/removing a returned column requires an explicit `DROP FUNCTION` first (see `0013_profile_bio.sql`).
- Write `create index if not exists` / `add column if not exists` for anything that might have partially applied before a later statement in the same file errored — SQL Editor runs a pasted script statement-by-statement, not as one atomic transaction, so a fixed-and-rerun migration must be safe to replay.

## Architecture

### Client is untyped, domain types are hand-maintained

`src/lib/supabase.ts` creates an **untyped** `createClient(...)` (no generated `Database` type). App-side row shapes are hand-written in `src/lib/types.ts` (and per-feature `types.ts` files) mirroring the SQL schema. If a migration changes a table/RPC shape, the corresponding hand-written TS interface must be updated in the same change — there's no codegen step catching drift. (`supabase gen types typescript --linked` would regenerate real types once the project is linked, per the root README, but that path isn't wired up yet.)

### Security model: RLS + SECURITY DEFINER RPCs, not app code

Authorization is enforced in Postgres, not in React. The load-bearing pieces (see `supabase/README.md` for the full list):
- `can_view_recipe(rid)` is the single source of truth for recipe visibility (public+published, or owner, or admin) and is reused by the RLS SELECT policy on every recipe child table (ingredients, steps, photos, stats) — private recipes can't leak through a child table query.
- `is_admin()` reads a table column; admin is never a JWT claim and can't be self-granted.
- Counts (`recipe_stats`) have no user-facing write policy — only triggers move them.
- Username is set once (NULL → value) during onboarding and is immutable after (enforced by a trigger, not just client logic).
- Storage buckets are public-read but path-scoped on write (`{auth.uid()}/...` only).

When adding a feature, check whether it needs a new RLS policy or a SECURITY DEFINER RPC before writing client code — the client should rarely need its own authorization checks beyond UI affordances.

### Recipe lifecycle: draft/publish vs. edit-in-place

Two different persistence paths feed the same step-wizard UI (`src/features/create/CreateRecipe.tsx` + `Step*.tsx`, all operating on the generic `DraftData` shape from `src/features/create/types.ts`):
- **Create** (`/create`): autosaves to the single-row-per-user `recipe_drafts` JSONB table as the user types, then `publish_draft(draft_id)` materializes it into `recipes` + children atomically and deletes the draft.
- **Edit** (`/r/:id/edit`, same `CreateRecipe` component, keyed off a route param): loads the existing recipe into the same `DraftData` shape, holds it in local state only (**no** autosave to `recipe_drafts` — that table is single-row-per-user and must not be clobbered by an unrelated edit session), and on save calls `update_recipe(recipe_id, data)`, which updates the `recipes` row and replaces its children (delete + re-insert) in one transaction.

Both RPCs expect the same JSON shape (see the comment atop `0007_drafts.sql`). If that shape changes, update `publish_draft`, `update_recipe`, `DraftData`, and `recipeToDraft()` in `CreateRecipe.tsx` together.

### Feed pagination pattern

Every list of recipes (Home/Discover, Following, Profile, Board, Search) shares one keyset-pagination hook, `useFeed` (`src/features/feed/useFeed.ts`), fed by a page-specific RPC (`feed_explore`, `feed_following`, `profile_recipes`, `collection_recipes`, `search_recipes`) that all return the shared `feed_card` Postgres composite type / `FeedCard` TS type. The cursor is `(created_at, id)`, never an offset. New feed-like screens should follow this same RPC-returns-`feed_card`-plus-`useFeed` pattern rather than inventing new pagination.

`FeedList` (`src/features/feed/FeedList.tsx`) renders that data two ways: `view="list"` (one column, `RecipeCard`) or `view="grid"` (uniform tiles, `RecipeGridCard`). Grid mode is **not** masonry — every tile is forced to the same `gridAspect` via `object-cover`, deliberately, so mixed photo shapes don't produce visually inconsistent cards.

### Uniform image system

`src/lib/constants.ts` defines the two canonical aspect ratios: `COVER_ASPECT` (3/4 portrait — Home/Search discover grids) and `SQUARE_ASPECT` (1:1 — Profile/Board grids, matching Instagram's profile-grid convention). `src/components/ImageCropper.tsx` is a from-scratch pan/zoom cropper (pointer-events based, no library) that lets the user frame the **cover photo** to `COVER_ASPECT` at upload time, wired in via an optional `aspect` prop on `src/components/PhotoButton.tsx`. Other photo uploads (gallery, step photos) go through `PhotoButton` without an `aspect` and skip cropping.

### Search

Hebrew has no Postgres full-text-search dictionary, so search (`0001`'s `recipes_title_trgm_idx`, extended in `0014_search.sql`) uses `pg_trgm` GIN indexes + `ILIKE '%term%'` rather than `tsvector`/`tsquery`. This is a deliberate, established pattern — follow it for any new searchable field rather than reaching for FTS. Recipe search matches title/caption/category/ingredient text (via `EXISTS`, not a join, so a recipe with multiple matching ingredients still returns one row); people search matches username/display name and is capped top-N rather than keyset-paginated.

### RTL / Hebrew conventions

- Root is `<html dir="rtl" lang="he">`. Use Tailwind **logical** utilities (`ps`/`pe`, `ms`/`me`, `start`/`end`), never `left`/`right`, so layout mirrors correctly.
- Wrap LTR content (numbers, times, `@usernames`) in `<span className="ltr">` (defined in `src/index.css`) to stop bidi scrambling.

### Design tokens

`tailwind.config.js` defines the full palette: `brand` (coral, primary), `accent` (mustard, secondary — save/bookmark/badge states), `stone` (hue-tinted neutrals, not flat gray), plus `success`/`danger`. Three font families, each with a narrow job: `sans` (Rubik/Assistant — body text, the default), `display` (Secular One — wordmark and page H1s only, used sparingly), `quote` (Frank Ruhl Libre — an occasional authentic/literary flourish, never body text). All icons are hand-drawn SVG components in `src/components/icons.tsx` — **no emoji as functional icons anywhere** (logo, nav, buttons, states); this was a deliberate cleanup and should stay that way.

### Folder layout

- `src/pages/` — route-level screens (one per top-level route in `App.tsx`).
- `src/features/<domain>/` — feature-scoped components + a local `types.ts` (e.g. `features/create`, `features/feed`, `features/collections`). Domain logic and RPC calls live here, close to the components that use them.
- `src/components/` — generic, cross-feature UI (`Avatar`, `SmartImage`, `PhotoButton`, `ImageCropper`, `icons.tsx`, `Layout.tsx`).
- `src/lib/` — framework-agnostic helpers (`supabase.ts` client, `images.ts` HEIC/compress pipeline, `storage.ts` upload wrappers, `time.ts`, `constants.ts`, `useScrollLock.ts`).
- Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`) — always import via `@/...`, not relative `../../`.

### Environment

Requires `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy from `.env.example`). The app throws intentionally on boot if either is missing — that's expected behavior, not a bug to fix.

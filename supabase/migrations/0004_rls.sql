-- ============================================================================
-- 0004_rls.sql — Enable RLS + all policies
-- Golden rules baked in here:
--   * Every recipe child table SELECT is gated by can_view_recipe() — private
--     recipes never leak through ingredients/steps/photos.
--   * collection_items SELECT requires BOTH the board visible AND the recipe
--     viewable — recipe privacy always wins over board visibility.
--   * notifications have NO insert policy — triggers only.
--   * counts live in recipe_stats with NO user write policy.
--   * is_admin / profiles.is_admin are never client-writable.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_stats        enable row level security;
alter table public.recipe_photos       enable row level security;
alter table public.ingredient_sections enable row level security;
alter table public.ingredient_items    enable row level security;
alter table public.instruction_steps   enable row level security;
alter table public.follows             enable row level security;
alter table public.likes               enable row level security;
alter table public.collections         enable row level security;
alter table public.collection_items    enable row level security;
alter table public.comments            enable row level security;
alter table public.notifications       enable row level security;
alter table public.reports             enable row level security;

-- ---------- profiles -------------------------------------------------------
create policy profiles_select on public.profiles for select using (true);
-- Insert happens via handle_new_user() trigger (definer). Allow self-insert as
-- a fallback but forbid granting admin.
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() and is_admin = false);
-- Self-update only, and cannot flip own is_admin. (protect_username guards username.)
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- ---------- categories (read-only to clients; managed by admin) ------------
create policy categories_select on public.categories for select using (true);
create policy categories_admin_write on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- recipes --------------------------------------------------------
create policy recipes_select on public.recipes for select using (
  (is_public and status = 'published') or author_id = auth.uid() or public.is_admin()
);
create policy recipes_insert on public.recipes for insert
  with check (author_id = auth.uid());
create policy recipes_update on public.recipes for update
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy recipes_delete on public.recipes for delete
  using (author_id = auth.uid() or public.is_admin());

-- ---------- recipe_stats (read if recipe viewable; NO user writes) ---------
create policy recipe_stats_select on public.recipe_stats for select
  using (public.can_view_recipe(recipe_id));
-- No insert/update/delete policies: only SECURITY DEFINER triggers touch this.

-- ---------- recipe children (view gated; write requires owning recipe) -----
create policy recipe_photos_select on public.recipe_photos for select
  using (public.can_view_recipe(recipe_id));
create policy recipe_photos_write on public.recipe_photos for all
  using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));

create policy ingredient_sections_select on public.ingredient_sections for select
  using (public.can_view_recipe(recipe_id));
create policy ingredient_sections_write on public.ingredient_sections for all
  using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));

-- ingredient_items are one join away — resolve section -> recipe.
create policy ingredient_items_select on public.ingredient_items for select
  using (public.can_view_recipe(
    (select s.recipe_id from public.ingredient_sections s where s.id = section_id)));
create policy ingredient_items_write on public.ingredient_items for all
  using (public.owns_recipe(
    (select s.recipe_id from public.ingredient_sections s where s.id = section_id)))
  with check (public.owns_recipe(
    (select s.recipe_id from public.ingredient_sections s where s.id = section_id)));

create policy instruction_steps_select on public.instruction_steps for select
  using (public.can_view_recipe(recipe_id));
create policy instruction_steps_write on public.instruction_steps for all
  using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));

-- ---------- follows --------------------------------------------------------
create policy follows_select on public.follows for select using (true);
create policy follows_insert on public.follows for insert
  with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete
  using (follower_id = auth.uid());

-- ---------- likes ----------------------------------------------------------
-- Can only like recipes you can see; can only like as yourself.
create policy likes_select on public.likes for select
  using (public.can_view_recipe(recipe_id));
create policy likes_insert on public.likes for insert
  with check (user_id = auth.uid() and public.can_view_recipe(recipe_id));
create policy likes_delete on public.likes for delete
  using (user_id = auth.uid());

-- ---------- collections (boards) -------------------------------------------
create policy collections_select on public.collections for select
  using (is_public or owner_id = auth.uid() or public.is_admin());
create policy collections_insert on public.collections for insert
  with check (owner_id = auth.uid());
create policy collections_update on public.collections for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Owner may delete, but never the default board.
create policy collections_delete on public.collections for delete
  using ((owner_id = auth.uid() and is_default = false) or public.is_admin());

-- ---------- collection_items ----------------------------------------------
-- Recipe privacy ALWAYS wins: item visible only if the board is visible AND
-- the recipe itself is viewable by the caller.
create policy collection_items_select on public.collection_items for select
  using (
    exists (select 1 from public.collections c
            where c.id = collection_id
              and (c.is_public or c.owner_id = auth.uid() or public.is_admin()))
    and public.can_view_recipe(recipe_id)
  );
create policy collection_items_insert on public.collection_items for insert
  with check (
    exists (select 1 from public.collections c
            where c.id = collection_id and c.owner_id = auth.uid())
    and public.can_view_recipe(recipe_id)
  );
create policy collection_items_delete on public.collection_items for delete
  using (
    exists (select 1 from public.collections c
            where c.id = collection_id and c.owner_id = auth.uid())
    or public.is_admin()
  );

-- ---------- comments -------------------------------------------------------
create policy comments_select on public.comments for select
  using (public.can_view_recipe(recipe_id));
create policy comments_insert on public.comments for insert
  with check (author_id = auth.uid() and public.can_view_recipe(recipe_id));
create policy comments_update on public.comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
-- Comment author, the recipe owner, or an admin may delete.
create policy comments_delete on public.comments for delete
  using (author_id = auth.uid() or public.owns_recipe(recipe_id) or public.is_admin());

-- ---------- notifications (own rows; NO insert policy) ---------------------
create policy notifications_select on public.notifications for select
  using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete
  using (recipient_id = auth.uid());

-- ---------- reports (anyone reports; only admin reads/manages) -------------
create policy reports_insert on public.reports for insert
  with check (reporter_id = auth.uid());
create policy reports_admin_select on public.reports for select
  using (public.is_admin());
create policy reports_admin_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

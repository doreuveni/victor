-- ============================================================================
-- 0010_collections.sql — Board detail feed RPC
-- SECURITY INVOKER: reuses feed_card (0008). collection_items_select already
-- requires the board to be visible (public, or owned by caller, or admin) AND
-- can_view_recipe(recipe_id), so a stranger browsing a public board still
-- never sees a recipe that has since gone private.
-- ============================================================================

create or replace function public.collection_recipes(
  p_collection_id  uuid,
  p_cursor_created timestamptz default null,
  p_cursor_id      uuid        default null,
  p_limit          int         default 12
) returns setof public.feed_card
language sql stable
set search_path = ''
as $$
  select r.id, r.title, r.cover_url, r.caption, ci.added_at,
         p.id, p.username, p.display_name, p.avatar_url,
         coalesce(s.like_count, 0), coalesce(s.comment_count, 0),
         c.name_he
  from public.collection_items ci
  join public.recipes r on r.id = ci.recipe_id
  join public.profiles p on p.id = r.author_id
  left join public.recipe_stats s on s.recipe_id = r.id
  left join public.categories c on c.id = r.category_id
  where ci.collection_id = p_collection_id
    and (
      p_cursor_created is null
      or (ci.added_at, r.id) < (p_cursor_created, p_cursor_id)
    )
  order by ci.added_at desc, r.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.collection_recipes(uuid, timestamptz, uuid, int) to authenticated;

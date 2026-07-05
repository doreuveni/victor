-- ============================================================================
-- 0015_recipe_edit.sql — Edit an existing recipe in place.
-- Mirrors publish_draft's materialization (same JSON shape from the same
-- step-wizard UI), but UPDATEs the recipes row and replaces its children
-- (delete + re-insert) instead of inserting a brand new recipe. Deleting the
-- old ingredient_sections/instruction_steps/recipe_photos is safe: every
-- child table that references them (ingredient_items, likes/comments stay on
-- the recipe itself, not these) cascades, and recipe_stats/likes/comments
-- are keyed off recipes.id which never changes here.
-- ============================================================================

create or replace function public.update_recipe(p_recipe_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner   uuid;
  v_section uuid;
  sec       jsonb;
  st        jsonb;
  it_text   text;
  ph        text;
  sec_pos   int := 0;
  it_pos    int := 0;
  st_num    int := 0;
  ph_pos    int := 0;
begin
  select author_id into v_owner from public.recipes where id = p_recipe_id;

  if v_owner is null then
    raise exception 'recipe not found';
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.recipes set
    title       = coalesce(nullif(trim(p_data ->> 'title'), ''), 'ללא כותרת'),
    caption     = nullif(trim(p_data ->> 'caption'), ''),
    category_id = nullif(p_data ->> 'category_id', '')::uuid,
    prep_min    = nullif(p_data ->> 'prep_min', '')::int,
    cook_min    = nullif(p_data ->> 'cook_min', '')::int,
    servings    = nullif(p_data ->> 'servings', '')::int,
    cover_url   = nullif(p_data ->> 'cover_url', ''),
    is_public   = coalesce((p_data ->> 'is_public')::boolean, true),
    updated_at  = now()
  where id = p_recipe_id;

  delete from public.recipe_photos where recipe_id = p_recipe_id;
  delete from public.ingredient_sections where recipe_id = p_recipe_id; -- cascades items
  delete from public.instruction_steps where recipe_id = p_recipe_id;

  for ph in select jsonb_array_elements_text(coalesce(p_data -> 'photos', '[]'::jsonb)) loop
    if trim(ph) <> '' then
      insert into public.recipe_photos (recipe_id, url, position)
      values (p_recipe_id, ph, ph_pos);
      ph_pos := ph_pos + 1;
    end if;
  end loop;

  for sec in select * from jsonb_array_elements(coalesce(p_data -> 'sections', '[]'::jsonb)) loop
    insert into public.ingredient_sections (recipe_id, name, position)
    values (p_recipe_id, nullif(trim(sec ->> 'name'), ''), sec_pos)
    returning id into v_section;
    sec_pos := sec_pos + 1;

    it_pos := 0;
    for it_text in select jsonb_array_elements_text(coalesce(sec -> 'items', '[]'::jsonb)) loop
      if trim(it_text) <> '' then
        insert into public.ingredient_items (section_id, text, position)
        values (v_section, it_text, it_pos);
        it_pos := it_pos + 1;
      end if;
    end loop;
  end loop;

  for st in select * from jsonb_array_elements(coalesce(p_data -> 'steps', '[]'::jsonb)) loop
    if trim(coalesce(st ->> 'text', '')) <> '' then
      st_num := st_num + 1;
      insert into public.instruction_steps (recipe_id, number, text, photo_url)
      values (p_recipe_id, st_num, st ->> 'text', nullif(st ->> 'photo_url', ''));
    end if;
  end loop;

  return p_recipe_id;
end;
$$;

grant execute on function public.update_recipe(uuid, jsonb) to authenticated;

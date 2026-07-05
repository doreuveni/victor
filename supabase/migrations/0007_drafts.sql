-- ============================================================================
-- 0007_drafts.sql — Wizard draft storage + atomic publish
-- The upload wizard autosaves the whole in-progress recipe as one JSONB blob
-- (one draft per user). Publishing materializes it into the normalized recipe
-- + child tables in a single transaction via publish_draft().
-- ============================================================================

create table public.recipe_drafts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- One active draft per user -> autosave is a simple upsert on owner_id.
create unique index recipe_drafts_owner_key on public.recipe_drafts (owner_id);

alter table public.recipe_drafts enable row level security;

create policy recipe_drafts_all on public.recipe_drafts for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- publish_draft(draft_id) -> new recipe id
-- Materializes the JSONB draft into recipes + photos + ingredient sections/
-- items + steps, atomically, then deletes the draft. SECURITY DEFINER but
-- strictly scoped to the caller's own draft.
--
-- Expected draft JSON shape:
--   { title, caption, category_id, prep_min, cook_min, servings, is_public,
--     cover_url, photos: [url...],
--     sections: [{ name, items: [text...] }],
--     steps: [{ text, photo_url }] }
-- ---------------------------------------------------------------------------
create or replace function public.publish_draft(p_draft_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  d         jsonb;
  v_owner   uuid;
  v_recipe  uuid;
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
  select data, owner_id into d, v_owner
  from public.recipe_drafts
  where id = p_draft_id and owner_id = auth.uid();

  if v_owner is null then
    raise exception 'draft not found or not owned by caller';
  end if;

  insert into public.recipes (
    author_id, title, caption, category_id,
    prep_min, cook_min, servings, cover_url, status, is_public
  ) values (
    v_owner,
    coalesce(nullif(trim(d ->> 'title'), ''), 'ללא כותרת'),
    nullif(trim(d ->> 'caption'), ''),
    nullif(d ->> 'category_id', '')::uuid,
    nullif(d ->> 'prep_min', '')::int,
    nullif(d ->> 'cook_min', '')::int,
    nullif(d ->> 'servings', '')::int,
    nullif(d ->> 'cover_url', ''),
    'published',
    coalesce((d ->> 'is_public')::boolean, true)
  ) returning id into v_recipe;

  -- Extra gallery photos.
  for ph in select jsonb_array_elements_text(coalesce(d -> 'photos', '[]'::jsonb)) loop
    if trim(ph) <> '' then
      insert into public.recipe_photos (recipe_id, url, position)
      values (v_recipe, ph, ph_pos);
      ph_pos := ph_pos + 1;
    end if;
  end loop;

  -- Ingredient sections + their line items.
  for sec in select * from jsonb_array_elements(coalesce(d -> 'sections', '[]'::jsonb)) loop
    insert into public.ingredient_sections (recipe_id, name, position)
    values (v_recipe, nullif(trim(sec ->> 'name'), ''), sec_pos)
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

  -- Instruction steps (renumbered 1..N, blanks skipped).
  for st in select * from jsonb_array_elements(coalesce(d -> 'steps', '[]'::jsonb)) loop
    if trim(coalesce(st ->> 'text', '')) <> '' then
      st_num := st_num + 1;
      insert into public.instruction_steps (recipe_id, number, text, photo_url)
      values (v_recipe, st_num, st ->> 'text', nullif(st ->> 'photo_url', ''));
    end if;
  end loop;

  delete from public.recipe_drafts where id = p_draft_id;
  return v_recipe;
end;
$$;

grant execute on function public.publish_draft(uuid) to authenticated;

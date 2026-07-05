-- ============================================================================
-- 0006_storage.sql — Storage buckets + policies
-- Decision: PUBLIC buckets (unlisted, not secret). Private recipes are hidden
-- in-app; their image URLs are technically reachable if guessed/shared.
-- Write access is locked to each user's own top-level folder: {auth.uid}/...
-- so nobody can overwrite another user's images.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---- recipe-photos --------------------------------------------------------
create policy "recipe-photos read"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');

create policy "recipe-photos insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-photos update own"
  on storage.objects for update
  using (bucket_id = 'recipe-photos' and owner = auth.uid());

create policy "recipe-photos delete own"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and owner = auth.uid());

-- ---- avatars --------------------------------------------------------------
create policy "avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars update own"
  on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars delete own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

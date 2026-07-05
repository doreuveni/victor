-- ============================================================================
-- 0003_triggers.sql — Wire trigger functions to tables
-- ============================================================================

-- New auth user -> profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Username immutability (BEFORE) + default board on first set (AFTER)
create trigger profiles_protect_username
  before update on public.profiles
  for each row execute function public.protect_username();

create trigger profiles_create_default_collection
  after update on public.profiles
  for each row execute function public.create_default_collection();

-- Recipes
create trigger recipes_before_write
  before insert or update on public.recipes
  for each row execute function public.recipe_before_write();

create trigger recipes_stats_row
  after insert on public.recipes
  for each row execute function public.recipe_after_insert_stats();

create trigger recipes_publish_fanout
  after insert or update on public.recipes
  for each row execute function public.recipe_after_publish_fanout();

-- Likes
create trigger likes_ins after insert on public.likes
  for each row execute function public.likes_after_insert();
create trigger likes_del after delete on public.likes
  for each row execute function public.likes_after_delete();

-- Comments
create trigger comments_ins after insert on public.comments
  for each row execute function public.comments_after_insert();
create trigger comments_del after delete on public.comments
  for each row execute function public.comments_after_delete();

-- Follows
create trigger follows_ins after insert on public.follows
  for each row execute function public.follows_after_insert();

-- Collection adds
create trigger collection_items_ins after insert on public.collection_items
  for each row execute function public.collection_items_after_insert();

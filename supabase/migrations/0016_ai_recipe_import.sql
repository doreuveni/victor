-- ============================================================================
-- 0016_ai_recipe_import.sql — Global daily cap for the AI photo-import feature
-- The feature costs real money per call (Anthropic API), so it's gated by a
-- global (not per-user) daily counter — this app has one real user today.
-- The counter table has no client-facing policy at all; the only way to touch
-- it is through the SECURITY DEFINER function below, same pattern as
-- publish_draft()/update_recipe() elsewhere in this schema.
-- ============================================================================

create table if not exists public.ai_import_usage (
  day   date primary key,
  count int  not null default 0
);

alter table public.ai_import_usage enable row level security;
-- Intentionally no policies: RLS with zero policies denies all direct client
-- access (select/insert/update/delete), so this table is reachable only via
-- the SECURITY DEFINER function below.

-- ---------------------------------------------------------------------------
-- try_increment_ai_import_count(p_limit) -> allowed?
-- Atomically bumps today's global counter and reports whether it was still
-- under the limit *before* this call. Called by the ai-recipe-import edge
-- function on behalf of the requesting user (forwarded JWT), not with a
-- service-role key — keeps authorization in Postgres rather than app code.
-- ---------------------------------------------------------------------------
create or replace function public.try_increment_ai_import_count(p_limit int default 20)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.ai_import_usage (day, count) values (current_date, 1)
  on conflict (day) do update set count = public.ai_import_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.try_increment_ai_import_count(int) to authenticated;

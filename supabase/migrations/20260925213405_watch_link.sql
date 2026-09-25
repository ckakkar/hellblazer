-- The Apple Watch app's credential: a long random token the iPhone app hands
-- the watch. Only its SHA-256 is stored. The watch API (src/app/api/watch)
-- resolves it to a user with the service role and scopes every query to them.
create table public.watch_link (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index watch_link_user_id_idx on public.watch_link (user_id);

alter table public.watch_link enable row level security;

create policy "watch_link_select_own" on public.watch_link
  for select to authenticated using (user_id = (select auth.uid()));
create policy "watch_link_insert_own" on public.watch_link
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "watch_link_delete_own" on public.watch_link
  for delete to authenticated using (user_id = (select auth.uid()));

-- last_performances() for the watch API, which has no user JWT: the user is
-- an argument, so only the service role may call it.
create or replace function public.watch_last_performances(
  p_user uuid,
  p_exercise_ids uuid[],
  p_exclude_session uuid default null
)
returns table(exercise_id uuid, set_number integer, weight_kg numeric, reps integer)
language sql
stable
set search_path = ''
as $$
  with latest as (
    select distinct on (w.exercise_id) w.exercise_id, w.session_id
    from public.v_working_set w
    where w.user_id = p_user
      and w.exercise_id = any(p_exercise_ids)
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
    order by w.exercise_id, w.session_date desc, w.session_id desc
  )
  select w.exercise_id, w.set_number, w.weight_kg, w.reps
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;

revoke execute on function public.watch_last_performances(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.watch_last_performances(uuid, uuid[], uuid) to service_role;

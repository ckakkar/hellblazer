-- Last session's RPE too, for next-time targets (src/lib/progression.ts):
-- an all-out last set holds the weight, an easy one on a freeform lift adds.
-- The return type changes, so each function is dropped and made again, in
-- one transaction, with its grants.

drop function public.last_performances(uuid[], uuid);
create function public.last_performances(
  p_exercise_ids uuid[],
  p_exclude_session uuid default null
)
returns table (
  exercise_id uuid,
  session_date date,
  set_number integer,
  weight_kg numeric,
  reps integer,
  rpe numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (w.exercise_id) w.exercise_id, w.session_id
    from public.v_working_set w
    where w.user_id = (select auth.uid())
      and w.exercise_id = any(p_exercise_ids)
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
    order by w.exercise_id, w.session_date desc, w.session_id desc
  )
  select w.exercise_id, w.session_date, w.set_number, w.weight_kg, w.reps, w.rpe
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;
revoke execute on function public.last_performances(uuid[], uuid) from public, anon;
grant execute on function public.last_performances(uuid[], uuid) to authenticated;

drop function public.watch_last_performances(uuid, uuid[], uuid);
create function public.watch_last_performances(
  p_user uuid,
  p_exercise_ids uuid[],
  p_exclude_session uuid default null
)
returns table(exercise_id uuid, set_number integer, weight_kg numeric, reps integer, rpe numeric)
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
  select w.exercise_id, w.set_number, w.weight_kg, w.reps, w.rpe
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;
revoke execute on function public.watch_last_performances(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.watch_last_performances(uuid, uuid[], uuid) to service_role;

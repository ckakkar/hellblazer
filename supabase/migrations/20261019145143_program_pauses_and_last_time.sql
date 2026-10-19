-- A program week survives a pause and a restart (src/lib/program-week.ts).
-- Resuming moves start_date on by the days paused, which pushed the week
-- past whatever was done before the pause; `pauses` records each one
-- ({at, days}) so those workouts still count where the stopped calendar has
-- them. A restart stamps `restarted_at`: workouts from before it, even
-- earlier the same day, no longer advance the fresh week 1.
alter table public.program
  add column pauses jsonb not null default '[]'::jsonb,
  add column restarted_at timestamptz;

-- Last time's numbers came from the latest session by date, ties broken by
-- session id, so of two on one day either could win. Now the later start
-- does.
create or replace function public.last_performances(
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
    join public.session s on s.id = w.session_id
    where w.user_id = (select auth.uid())
      and w.exercise_id = any(p_exercise_ids)
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
    order by w.exercise_id, w.session_date desc, s.created_at desc, w.session_id desc
  )
  select w.exercise_id, w.session_date, w.set_number, w.weight_kg, w.reps, w.rpe
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;

create or replace function public.watch_last_performances(
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
    join public.session s on s.id = w.session_id
    where w.user_id = p_user
      and w.exercise_id = any(p_exercise_ids)
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
    order by w.exercise_id, w.session_date desc, s.created_at desc, w.session_id desc
  )
  select w.exercise_id, w.set_number, w.weight_kg, w.reps, w.rpe
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;

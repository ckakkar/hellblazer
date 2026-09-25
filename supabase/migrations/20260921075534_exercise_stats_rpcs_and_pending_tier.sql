-- Per-exercise aggregates computed in Postgres, so no read has to pull raw
-- working sets past PostgREST's row cap. Security invoker: RLS on the
-- underlying tables (via the security-invoker views) still applies.
create or replace function public.exercise_stats(p_exclude_session uuid default null)
returns table (
  exercise_id uuid,
  exercise_name text,
  primary_muscle public.muscle_group,
  best_est_1rm numeric,
  best_weight_kg numeric,
  best_reps integer,
  top_weight_kg numeric,
  best_set_volume numeric,
  sessions_logged integer,
  first_est_1rm numeric,
  last_est_1rm numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ws as (
    select w.exercise_id, w.exercise_name, w.primary_muscle, w.session_id,
           w.session_date, w.weight_kg, w.reps, w.est_1rm, w.volume
    from public.v_working_set w
    where w.user_id = (select auth.uid())
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
  ),
  best_set as (
    -- The set behind the best est. 1RM (heavier load breaks ties).
    select distinct on (exercise_id)
           exercise_id, exercise_name, primary_muscle, est_1rm, weight_kg, reps
    from ws
    order by exercise_id, est_1rm desc, weight_kg desc
  ),
  per_session as (
    select exercise_id, session_id, session_date, max(est_1rm) as e1rm
    from ws
    group by exercise_id, session_id, session_date
  ),
  first_last as (
    select distinct
           exercise_id,
           first_value(e1rm) over (partition by exercise_id order by session_date, session_id) as first_e1rm,
           first_value(e1rm) over (partition by exercise_id order by session_date desc, session_id desc) as last_e1rm
    from per_session
  ),
  agg as (
    select exercise_id,
           max(weight_kg) as top_weight,
           max(volume) as best_vol,
           count(distinct session_id)::integer as sessions
    from ws
    group by exercise_id
  )
  select b.exercise_id, b.exercise_name, b.primary_muscle,
         b.est_1rm, b.weight_kg, b.reps,
         a.top_weight, a.best_vol, a.sessions,
         fl.first_e1rm, fl.last_e1rm
  from best_set b
  join agg a using (exercise_id)
  join first_last fl using (exercise_id)
  order by b.est_1rm desc;
$$;

-- Each exercise's most recent prior session, picked in Postgres.
create or replace function public.last_performances(
  p_exercise_ids uuid[],
  p_exclude_session uuid default null
)
returns table (
  exercise_id uuid,
  session_date date,
  set_number integer,
  weight_kg numeric,
  reps integer
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
  select w.exercise_id, w.session_date, w.set_number, w.weight_kg, w.reps
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;

revoke execute on function public.exercise_stats(uuid) from public, anon;
revoke execute on function public.last_performances(uuid[], uuid) from public, anon;
grant execute on function public.exercise_stats(uuid) to authenticated;
grant execute on function public.last_performances(uuid[], uuid) to authenticated;

-- The judge's latest verdict, awaiting accept/decline. Server-written only
-- once the rank-column lockdown lands.
alter table public.profile
  add column if not exists pending_tier text,
  add column if not exists pending_tier_rationale text;

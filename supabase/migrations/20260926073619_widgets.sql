-- Widgets that refresh themselves: the iPhone app gets its own device token
-- (like the watch's), so a background push can have it fetch a fresh widget
-- snapshot from /api/device/snapshot. That route runs as the service role,
-- so the two functions it needs take the lifter as an argument, honoured only
-- when there's no signed-in user (the same pattern as start_session).

alter table public.watch_link
  add column kind text not null default 'watch' check (kind in ('watch', 'phone'));

-- exercise_stats, now callable for a given lifter by the service role.
drop function public.exercise_stats(uuid);
create function public.exercise_stats(p_exclude_session uuid default null, p_user uuid default null)
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
    where w.user_id = coalesce((select auth.uid()), p_user)
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

-- The estimated-max history the Lift Trend widget draws: each of the most
-- trained lifts' best est. 1RM per session, the latest p_points sessions.
create function public.lift_trends(p_user uuid default null, p_lifts int default 12, p_points int default 16)
returns table (exercise_id uuid, exercise_name text, session_date date, best_est_1rm numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select p.exercise_id, p.exercise_name, p.session_id, p.session_date, p.best_est_1rm
    from public.v_exercise_progression p
    where p.user_id = coalesce((select auth.uid()), p_user)
  ),
  top_lifts as (
    select m.exercise_id
    from mine m
    group by m.exercise_id
    order by count(*) desc, max(m.session_date) desc
    limit greatest(1, least(p_lifts, 40))
  ),
  ranked as (
    select m.exercise_id, m.exercise_name, m.session_date, m.best_est_1rm,
           row_number() over (partition by m.exercise_id order by m.session_date desc, m.session_id desc) as rn
    from mine m
    join top_lifts t on t.exercise_id = m.exercise_id
  )
  select r.exercise_id, r.exercise_name, r.session_date, r.best_est_1rm
  from ranked r
  where r.rn <= greatest(2, least(p_points, 52))
  order by r.exercise_id, r.session_date;
$$;

revoke execute on function public.exercise_stats(uuid, uuid) from public, anon;
revoke execute on function public.lift_trends(uuid, int, int) from public, anon;
grant execute on function public.exercise_stats(uuid, uuid) to authenticated, service_role;
grant execute on function public.lift_trends(uuid, int, int) to authenticated, service_role;

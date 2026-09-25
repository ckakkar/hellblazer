-- All views are security_invoker: they run as the querying user, so the
-- underlying-table RLS policies apply and each user sees only their own rows.

-- Base view: one row per *working* set (warmups/incomplete excluded), enriched
-- with the derived per-set metrics used everywhere downstream.
--   est_1rm : Epley formula  weight * (1 + reps/30)
--   volume  : weight_kg * reps
create view v_working_set with (security_invoker = true) as
select
  s.id                                       as set_id,
  s.user_id,
  s.weight_kg,
  s.reps,
  s.rpe,
  s.set_number,
  round(s.weight_kg * (1 + s.reps::numeric / 30), 2) as est_1rm,
  (s.weight_kg * s.reps)                     as volume,
  se.id                                      as session_exercise_id,
  se.exercise_id,
  e.name                                     as exercise_name,
  e.primary_muscle,
  e.secondary_muscles,
  sess.id                                    as session_id,
  sess.date                                  as session_date
from "set" s
join session_exercise se on se.id = s.session_exercise_id
join session sess        on sess.id = se.session_id
join exercise e          on e.id = se.exercise_id
where s.is_warmup = false and s.is_completed = true;

-- Weekly sets & volume per muscle (ISO week, Monday-start via date_trunc).
-- A working set contributes 1.0 set + full volume to its PRIMARY muscle, and
-- 0.5 sets + 0.5 * volume to EACH secondary muscle. This is the weak-point view.
create view v_weekly_sets_per_muscle with (security_invoker = true) as
with contrib as (
  select user_id,
         date_trunc('week', session_date)::date as week,
         primary_muscle                          as muscle,
         1.0::numeric                            as sets,
         volume::numeric                         as volume
  from v_working_set
  union all
  select user_id,
         date_trunc('week', session_date)::date as week,
         unnest(secondary_muscles)               as muscle,
         0.5::numeric                            as sets,
         (volume * 0.5)::numeric                 as volume
  from v_working_set
)
select user_id, week, muscle,
       sum(sets)   as sets,
       sum(volume) as volume
from contrib
group by user_id, week, muscle;

-- 1RM progression per exercise: best working set metrics per session.
-- Feeds the per-exercise 1RM line chart, volume bars, and PR table.
create view v_exercise_progression with (security_invoker = true) as
select
  user_id,
  exercise_id,
  exercise_name,
  session_id,
  session_date,
  max(est_1rm)   as best_est_1rm,
  max(weight_kg) as top_weight,
  sum(volume)    as volume,
  max(volume)    as best_set_volume
from v_working_set
group by user_id, exercise_id, exercise_name, session_id, session_date;

-- Per-session rollup for history + dashboard (includes freeform/empty sessions).
create view v_session_summary with (security_invoker = true) as
select
  sess.id         as session_id,
  sess.user_id,
  sess.date       as session_date,
  sess.title,
  sess.template_id,
  sess.duration_min,
  count(distinct se.id)                                  as exercise_count,
  count(s.id) filter (where s.is_warmup = false and s.is_completed = true) as working_sets,
  coalesce(sum(s.weight_kg * s.reps)
    filter (where s.is_warmup = false and s.is_completed = true), 0)       as total_volume
from session sess
left join session_exercise se on se.session_id = sess.id
left join "set" s             on s.session_exercise_id = se.id
group by sess.id;

grant select on v_working_set, v_weekly_sets_per_muscle,
                v_exercise_progression, v_session_summary
  to authenticated;

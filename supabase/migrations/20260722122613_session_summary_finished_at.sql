-- Expose finished_at on the session rollup so lists can badge in-progress
-- sessions and link them back to the live logger. Column appended last so
-- CREATE OR REPLACE is valid against the existing view shape.
create or replace view v_session_summary with (security_invoker = true) as
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
    filter (where s.is_warmup = false and s.is_completed = true), 0)       as total_volume,
  sess.finished_at
from session sess
left join session_exercise se on se.session_id = sess.id
left join "set" s             on s.session_exercise_id = se.id
group by sess.id;

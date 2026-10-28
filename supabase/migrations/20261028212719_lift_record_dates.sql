-- When each lift's all-time best estimated max was first reached, over its
-- whole history (the Last PR widget's record), and how many sessions came
-- before it (0: its first session, which isn't a record). Read from the
-- complete history, not a recent window, so a best reached long ago and
-- merely matched lately is never redated. Same-day sessions go in the order
-- they started.
create or replace function public.lift_record_dates(p_user uuid default null)
returns table(exercise_id uuid, record_date date, sessions_before integer)
language sql
stable
set search_path = ''
as $$
  with mine as (
    select p.exercise_id, p.session_date, p.session_started_at, p.session_id, p.best_est_1rm,
           max(p.best_est_1rm) over (partition by p.exercise_id) as best,
           row_number() over (
             partition by p.exercise_id
             order by p.session_date, p.session_started_at, p.session_id
           ) as n
    from public.v_exercise_progression p
    where p.user_id = coalesce((select auth.uid()), p_user)
  )
  select distinct on (m.exercise_id) m.exercise_id, m.session_date, (m.n - 1)::integer
  from mine m
  where m.best_est_1rm >= m.best
  order by m.exercise_id, m.session_date, m.session_started_at, m.session_id;
$$;

revoke all on function public.lift_record_dates(uuid) from public, anon;
grant execute on function public.lift_record_dates(uuid) to authenticated, service_role;

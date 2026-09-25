-- Working sets per ISO week by rep range: 1-5 (strength), 6-12 (hypertrophy),
-- 13+ (endurance). Security invoker over RLS'd views, so it only ever sees
-- the caller's own sets. p_since is the lifter's local date.
create or replace function public.rep_range_weekly(p_since date)
returns table (week date, strength bigint, hypertrophy bigint, endurance bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select date_trunc('week', session_date)::date as week,
         count(*) filter (where reps between 1 and 5)  as strength,
         count(*) filter (where reps between 6 and 12) as hypertrophy,
         count(*) filter (where reps >= 13)            as endurance
  from v_working_set
  where session_date >= p_since
  group by 1
  order by 1;
$$;

-- Personal records as events: a session whose heaviest working set, or best
-- estimated 1RM, beat every earlier session of that lift. A lift's first
-- session isn't a record (nothing to beat). Newest first.
create or replace function public.recent_records(p_limit int default 6)
returns table (
  exercise_id uuid,
  exercise_name text,
  session_id uuid,
  session_date date,
  kind text,
  value numeric,
  previous numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with p as (
    select exercise_id, exercise_name, session_id, session_date,
           best_est_1rm, top_weight,
           max(best_est_1rm) over w as prev_e1rm,
           max(top_weight)   over w as prev_top
    from v_exercise_progression
    window w as (
      partition by exercise_id
      order by session_date, session_id
      rows between unbounded preceding and 1 preceding
    )
  )
  select exercise_id, exercise_name, session_id, session_date,
         case when top_weight > prev_top + 0.01 then 'weight' else 'e1rm' end,
         case when top_weight > prev_top + 0.01 then top_weight else best_est_1rm end,
         case when top_weight > prev_top + 0.01 then prev_top else prev_e1rm end
  from p
  where prev_e1rm is not null
    and (top_weight > prev_top + 0.01 or best_est_1rm > prev_e1rm + 0.01)
  order by session_date desc, exercise_name
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.rep_range_weekly(date) from public, anon;
revoke execute on function public.recent_records(int) from public, anon;
grant execute on function public.rep_range_weekly(date) to authenticated;
grant execute on function public.recent_records(int) to authenticated;

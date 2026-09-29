-- A drop set counts as a full set toward its muscles' weekly sets, like
-- any other working set (the lifter's call): 1 to the primary muscle, 0.5
-- to each secondary, as before drop sets existed.
create or replace view public.v_weekly_sets_per_muscle with (security_invoker = true) as
with contrib as (
  select user_id,
         date_trunc('week', session_date)::date as week,
         primary_muscle                          as muscle,
         1.0::numeric                            as sets,
         volume::numeric                         as volume
  from public.v_working_set
  union all
  select user_id,
         date_trunc('week', session_date)::date as week,
         unnest(secondary_muscles)               as muscle,
         0.5::numeric                            as sets,
         (volume * 0.5)::numeric                 as volume
  from public.v_working_set
)
select user_id, week, muscle,
       sum(sets)   as sets,
       sum(volume) as volume
from contrib
group by user_id, week, muscle;

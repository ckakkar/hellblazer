-- Supersets: exercises done back to back, resting only after the round.
-- A group number; consecutive exercises sharing one are a superset (A1, A2
-- in the app), so reordering can only ever split a group, never mix two.
-- Null: on its own.
alter table public.template_exercise
  add column superset smallint constraint template_exercise_superset_range check (superset between 1 and 99);
alter table public.session_exercise
  add column superset smallint constraint session_exercise_superset_range check (superset between 1 and 99);

-- What kind of working set, beyond a plain one: a drop set (lighter, straight
-- after the set before) or a rest-pause set. Null: a plain set.
alter table public."set"
  add column kind text constraint set_kind_check check (kind in ('drop', 'rest_pause'));

-- Working sets carry their kind, for the weekly count below.
create or replace view public.v_working_set with (security_invoker = true) as
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
  sess.date                                  as session_date,
  s.kind
from public."set" s
join public.session_exercise se on se.id = s.session_exercise_id
join public.session sess        on sess.id = se.session_id
join public.exercise e          on e.id = se.exercise_id
where s.is_warmup = false and s.is_completed = true;

-- A drop set counts as half a set toward its muscles' weekly sets (the usual
-- coaching view: it extends the set before rather than being one of its own).
-- Its volume counts in full.
create or replace view public.v_weekly_sets_per_muscle with (security_invoker = true) as
with contrib as (
  select user_id,
         date_trunc('week', session_date)::date as week,
         primary_muscle                          as muscle,
         (case when kind = 'drop' then 0.5 else 1.0 end)::numeric as sets,
         volume::numeric                         as volume
  from public.v_working_set
  union all
  select user_id,
         date_trunc('week', session_date)::date as week,
         unnest(secondary_muscles)               as muscle,
         (case when kind = 'drop' then 0.25 else 0.5 end)::numeric as sets,
         (volume * 0.5)::numeric                 as volume
  from public.v_working_set
)
select user_id, week, muscle,
       sum(sets)   as sets,
       sum(volume) as volume
from contrib
group by user_id, week, muscle;

-- Starting a workout from a template copies its supersets too.
create or replace function public.start_session(
  p_template_id uuid default null,
  p_program_day_id uuid default null,
  p_date date default null,
  p_user uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_user uuid := coalesce(v_caller, p_user);
  v_template uuid := p_template_id;
  v_program uuid;
  v_title text;
  v_session uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if v_caller is not null and p_user is not null and p_user <> v_caller then
    raise exception 'not allowed';
  end if;

  -- Only an explicit program day counts toward the program.
  if p_program_day_id is not null then
    select pd.template_id, pd.program_id into v_template, v_program
    from public.program_day pd
    where pd.id = p_program_day_id and pd.user_id = v_user;
    if not found then
      raise exception 'program day not found';
    end if;
  end if;

  if v_template is not null then
    select coalesce(nullif(t.day_label, ''), t.name) into v_title
    from public.workout_template t
    where t.id = v_template and t.user_id = v_user;
    if not found then
      raise exception 'template not found';
    end if;
  end if;

  insert into public.session (user_id, template_id, program_id, title, date)
  values (v_user, v_template, v_program, v_title, coalesce(p_date, current_date))
  returning id into v_session;

  if v_template is not null then
    insert into public.session_exercise (user_id, session_id, exercise_id, position, note, superset)
    select v_user, v_session, te.exercise_id, te.position, te.note, te.superset
    from public.template_exercise te
    where te.template_id = v_template and te.user_id = v_user
    order by te.position;
  end if;

  return v_session;
end;
$$;

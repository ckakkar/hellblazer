-- A session keeps the targets it started with. They used to be read from the
-- template at the session's position, so reordering the template mid-workout
-- (or after) gave a session's exercises another movement's sets, reps and
-- rest. Now start_session copies them onto session_exercise, and sessions
-- from before are backfilled the way the app matched them until now.
alter table public.session_exercise
  add column target_sets integer,
  add column target_rep_range text,
  add column rest_seconds integer,
  add constraint session_exercise_rest_seconds_range check (rest_seconds between 15 and 600);

update public.session_exercise se
set target_sets = te.target_sets,
    target_rep_range = te.target_rep_range,
    rest_seconds = te.rest_seconds
from public.session s
join public.template_exercise te on te.template_id = s.template_id
where se.session_id = s.id
  and te.position = se.position
  and s.template_id is not null;

-- One workout at a time, enforced where it can't race. The app checked for a
-- workout under way and then called start_session, so a start on the phone
-- and one on the watch at the same moment could both pass and open two.
-- Each lifter's starts now queue on a lock, and a start while a workout is
-- under way returns that one (left open past six hours, it doesn't count:
-- STALE_CLOCK_MS in the app).
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('start_session:' || v_user::text, 0));
  select s.id into v_session
  from public.session s
  where s.user_id = v_user
    and s.finished_at is null
    and s.created_at > now() - interval '6 hours'
  order by s.created_at desc
  limit 1;
  if v_session is not null then
    return v_session;
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
    insert into public.session_exercise (
      user_id, session_id, exercise_id, position, note, superset,
      target_sets, target_rep_range, rest_seconds
    )
    select v_user, v_session, te.exercise_id, te.position, te.note, te.superset,
           te.target_sets, te.target_rep_range, te.rest_seconds
    from public.template_exercise te
    where te.template_id = v_template and te.user_id = v_user
    order by te.position;
  end if;

  return v_session;
end;
$$;

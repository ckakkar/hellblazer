-- The review's second round: what a program day is, a trash for deleted
-- workouts, safe appends, hands-free sets that can't double, push that keeps
-- widgets fresh without alerts, and reminders that can't go out twice.

-- ── A program day is the one actually done (R09) ────────────────────────────
-- A workout started from a program now records which of its days it was, so
-- doing Day 3 first counts as Day 3, and a template used on two days of a
-- rotation counts as the day it was picked for. The week counts only
-- workouts with sets in them that were finished (or left open past six
-- hours, the app's stale clock), so an empty or abandoned start doesn't use
-- up a day.
alter table public.session
  add column program_day_id uuid,
  add constraint session_program_day_id_fkey
    foreign key (program_day_id, user_id) references public.program_day (id, user_id) on delete set null (program_day_id);
create index session_program_day_id_idx on public.session (program_day_id) where program_day_id is not null;

-- Workouts from before: where the template is on just one day of its
-- program, that's the day it was. A template on two days stays unknown, and
-- the week counts it in order, as it always did.
update public.session s
set program_day_id = pd.id
from public.program_day pd
where s.program_id = pd.program_id
  and s.template_id = pd.template_id
  and s.program_day_id is null
  and (
    select count(*) from public.program_day p2
    where p2.program_id = pd.program_id and p2.template_id = pd.template_id
  ) = 1;

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

  insert into public.session (user_id, template_id, program_id, program_day_id, title, date)
  values (v_user, v_template, v_program, p_program_day_id, v_title, coalesce(p_date, current_date))
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

-- The summary carries what the week and the streak need: which program and
-- day a workout was, and when it was started.
create or replace view public.v_session_summary
with (security_invoker = true) as
select sess.id as session_id,
    sess.user_id,
    sess.date as session_date,
    sess.title,
    sess.template_id,
    sess.duration_min,
    count(distinct se.id) as exercise_count,
    count(s.id) filter (where s.is_warmup = false and s.is_completed = true) as working_sets,
    coalesce(sum(s.weight_kg * s.reps::numeric) filter (where s.is_warmup = false and s.is_completed = true), 0::numeric) as total_volume,
    sess.finished_at,
    sess.program_id,
    sess.program_day_id,
    sess.created_at
from public.session sess
left join public.session_exercise se on se.session_id = sess.id
left join public."set" s on s.session_exercise_id = se.id
group by sess.id;

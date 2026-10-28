-- The October 2026 review's database fixes, in one step.
--
-- 1. Drafts are the lifter's. A starter routine's copies are marked
--    `from_preset`, and the mark clears the moment the lifter changes one.
--    Loading a preset (and "Clean up") only ever removes untouched starter
--    copies that were never trained: a program or template you wrote, or
--    edited, is never deleted behind your back.
-- 2. The numbers have floors and ceilings in the database too, not only in
--    the app's own checks: a direct API write can't land a 0-rep set or a
--    10,000-character template name.
-- 3. A profile can't be deleted by its own token (it holds the judge's
--    cooldown, which a delete-and-recreate would reset). Deleting the
--    account still removes it, through the auth user's cascade.
-- 4. The judge: one evaluation in flight per lifter, and each verdict has an
--    id, so accepting takes the verdict that was shown and no other.
-- 5. Same-day order: two workouts on one date are ordered by when they
--    started, not by their ids, in every progression read.
-- 6. "Done with this one" is kept with the workout (`ended_at`), so the
--    watch, Siri and a reload agree on what's next.

-- 1. Provenance -------------------------------------------------------------

alter table public.workout_template add column from_preset boolean not null default false;
alter table public.program add column from_preset boolean not null default false;

-- Renaming a template, or changing its exercises, makes it the lifter's.
create or replace function public.template_authored()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name or new.day_label is distinct from old.day_label then
    new.from_preset := false;
  end if;
  return new;
end;
$$;

create trigger workout_template_authored
before update on public.workout_template
for each row execute function public.template_authored();

-- Cascades (a template or program being deleted) arrive from the foreign
-- key's own trigger, one level down; they aren't edits.
create or replace function public.template_exercise_authored()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 then
    update public.workout_template set from_preset = false
    where id = coalesce(new.template_id, old.template_id) and from_preset;
  end if;
  return null;
end;
$$;

create trigger template_exercise_authored
after insert or update or delete on public.template_exercise
for each row execute function public.template_exercise_authored();

create or replace function public.program_authored()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
     or new.notes is distinct from old.notes
     or new.duration_weeks is distinct from old.duration_weeks then
    new.from_preset := false;
  end if;
  return new;
end;
$$;

create trigger program_authored
before update on public.program
for each row execute function public.program_authored();

create or replace function public.program_day_authored()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 then
    update public.program set from_preset = false
    where id = coalesce(new.program_id, old.program_id) and from_preset;
  end if;
  return null;
end;
$$;

create trigger program_day_authored
after insert or update or delete on public.program_day
for each row execute function public.program_day_authored();

-- Only untouched, untrained starter copies go. Returns how many went.
drop function public.purge_abandoned_templates();
create function public.purge_abandoned_templates()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_programs int;
  v_templates int;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  delete from public.program p
  where p.user_id = v_user
    and p.from_preset
    and not p.is_active
    and not exists (select 1 from public.session s where s.program_id = p.id)
    -- A day the lifter changed makes its program theirs too.
    and not exists (
      select 1 from public.program_day d
      join public.workout_template t on t.id = d.template_id
      where d.program_id = p.id and not t.from_preset
    );
  get diagnostics v_programs = row_count;
  delete from public.workout_template t
  where t.user_id = v_user
    and t.from_preset
    and not exists (select 1 from public.program_day d where d.template_id = t.id)
    and not exists (select 1 from public.session s where s.template_id = t.id);
  get diagnostics v_templates = row_count;
  return v_programs + v_templates;
end;
$$;

revoke all on function public.purge_abandoned_templates() from public, anon;
grant execute on function public.purge_abandoned_templates() to authenticated, service_role;
revoke all on function public.template_authored() from public, anon, authenticated;
revoke all on function public.template_exercise_authored() from public, anon, authenticated;
revoke all on function public.program_authored() from public, anon, authenticated;
revoke all on function public.program_day_authored() from public, anon, authenticated;

-- As before, but its copies are marked once they're whole (marking after
-- the exercises and days are in, so the triggers above don't clear it).
create or replace function public.load_preset(p_name text, p_weeks int, p_today date, p_days jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_position int;
  v_day jsonb;
  v_template uuid;
  v_templates uuid[] := '{}';
  v_program uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  update public.program set is_active = false where user_id = v_user and is_active;
  perform public.purge_abandoned_templates();

  select coalesce(max(position), -1) + 1 into v_position
  from public.workout_template where user_id = v_user;

  for v_day in select value from jsonb_array_elements(p_days) loop
    insert into public.workout_template (user_id, name, day_label, position)
    values (v_user, v_day->>'name', v_day->>'dayLabel', v_position)
    returning id into v_template;
    v_position := v_position + 1;
    v_templates := v_templates || v_template;

    insert into public.template_exercise
      (user_id, template_id, exercise_id, position, target_sets, target_rep_range, note)
    select v_user, v_template, lib.id, (ex.ord - 1)::int,
           (ex.value->>'sets')::int, ex.value->>'reps', ex.value->>'note'
    from jsonb_array_elements(coalesce(v_day->'exercises', '[]')) with ordinality as ex(value, ord)
    cross join lateral (
      select e.id from public.exercise e
      where lower(e.name) = lower(ex.value->>'name')
        and (e.user_id is null or e.user_id = v_user)
      order by (e.user_id is not null), e.created_at
      limit 1
    ) lib;
  end loop;

  insert into public.program (user_id, name, duration_weeks, start_date, is_active)
  values (v_user, p_name, coalesce(p_weeks, 8), p_today, true)
  returning id into v_program;

  insert into public.program_day (user_id, program_id, template_id, position)
  select v_user, v_program, t.id, (t.ord - 1)::int
  from unnest(v_templates) with ordinality as t(id, ord);

  update public.workout_template set from_preset = true where id = any(v_templates);
  update public.program set from_preset = true where id = v_program;

  return v_program;
end;
$$;

-- 2. Bounds -----------------------------------------------------------------

-- (A set's reps floor, 1, lands with the logger that stops saving empty
-- drafts: 20261028214208_set_reps_floor.sql.)
alter table public.set
  add constraint set_number_range check (set_number between 1 and 999),
  add constraint set_weight_nonnegative check (weight_kg >= 0);

alter table public.session
  add constraint session_title_len check (title is null or char_length(title) <= 120),
  add constraint session_notes_len check (notes is null or char_length(notes) <= 2000),
  add constraint session_duration_range check (duration_min is null or duration_min between 0 and 1000);

alter table public.session_exercise
  add constraint session_exercise_note_len check (note is null or char_length(note) <= 500),
  add constraint session_exercise_target_sets_range check (target_sets is null or target_sets between 1 and 20),
  add constraint session_exercise_rep_range_len check (target_rep_range is null or char_length(target_rep_range) <= 20);

alter table public.template_exercise
  add constraint template_exercise_note_len check (note is null or char_length(note) <= 500),
  add constraint template_exercise_target_sets_range check (target_sets is null or target_sets between 1 and 20),
  add constraint template_exercise_rep_range_len check (target_rep_range is null or char_length(target_rep_range) <= 20);

alter table public.workout_template
  add constraint workout_template_name_len check (char_length(name) between 1 and 120),
  add constraint workout_template_day_label_len check (day_label is null or char_length(day_label) <= 120);

alter table public.program
  add constraint program_name_len check (char_length(name) between 1 and 120),
  add constraint program_notes_len check (notes is null or char_length(notes) <= 2000);

alter table public.exercise
  add constraint exercise_name_len check (char_length(name) between 1 and 120),
  add constraint exercise_rep_range_len check (default_rep_range is null or char_length(default_rep_range) <= 20),
  add constraint exercise_secondary_count check (cardinality(secondary_muscles) <= 6);

alter table public.bodyweight_log
  add constraint bodyweight_log_range check (weight_kg between 1 and 999);

-- 3. The profile outlives its token's wishes --------------------------------

revoke delete on public.profile from anon, authenticated;

-- No client path truncates anything (PostgREST can't), so nobody needs it.
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate on public.%I from anon, authenticated', r.tablename);
  end loop;
end;
$$;

-- 4. The judge ---------------------------------------------------------------

-- Server-only, like the other rank columns: the lifter's token was given
-- UPDATE on named columns only (lock_profile_rank_columns), not these.
alter table public.profile
  add column evaluation_started_at timestamptz,
  add column pending_tier_id uuid;

-- 5. Same-day order ----------------------------------------------------------

create or replace view public.v_working_set
with (security_invoker = true)
as
select s.id as set_id,
       s.user_id,
       s.weight_kg,
       s.reps,
       s.rpe,
       s.set_number,
       round(s.weight_kg * (1::numeric + s.reps::numeric / 30::numeric), 2) as est_1rm,
       s.weight_kg * s.reps::numeric as volume,
       se.id as session_exercise_id,
       se.exercise_id,
       e.name as exercise_name,
       e.primary_muscle,
       e.secondary_muscles,
       sess.id as session_id,
       sess.date as session_date,
       s.kind,
       sess.created_at as session_started_at
from public.set s
join public.session_exercise se on se.id = s.session_exercise_id
join public.session sess on sess.id = se.session_id
join public.exercise e on e.id = se.exercise_id
where s.is_warmup = false and s.is_completed = true;

create or replace view public.v_exercise_progression
with (security_invoker = true)
as
select user_id,
       exercise_id,
       exercise_name,
       session_id,
       session_date,
       max(est_1rm) as best_est_1rm,
       max(weight_kg) as top_weight,
       sum(volume) as volume,
       max(volume) as best_set_volume,
       session_started_at
from public.v_working_set
group by user_id, exercise_id, exercise_name, session_id, session_date, session_started_at;

create or replace function public.exercise_stats(p_exclude_session uuid default null, p_user uuid default null)
returns table(exercise_id uuid, exercise_name text, primary_muscle public.muscle_group, best_est_1rm numeric,
              best_weight_kg numeric, best_reps integer, top_weight_kg numeric, best_set_volume numeric,
              sessions_logged integer, first_est_1rm numeric, last_est_1rm numeric)
language sql
stable
set search_path = ''
as $$
  with ws as (
    select w.exercise_id, w.exercise_name, w.primary_muscle, w.session_id,
           w.session_date, w.session_started_at, w.weight_kg, w.reps, w.est_1rm, w.volume
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
    select exercise_id, session_id, session_date, session_started_at, max(est_1rm) as e1rm
    from ws
    group by exercise_id, session_id, session_date, session_started_at
  ),
  first_last as (
    select distinct
           exercise_id,
           first_value(e1rm) over (partition by exercise_id order by session_date, session_started_at, session_id) as first_e1rm,
           first_value(e1rm) over (partition by exercise_id order by session_date desc, session_started_at desc, session_id desc) as last_e1rm
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

create or replace function public.lift_trends(p_user uuid default null, p_lifts integer default 12, p_points integer default 16)
returns table(exercise_id uuid, exercise_name text, session_date date, best_est_1rm numeric)
language sql
stable
set search_path = ''
as $$
  with mine as (
    select p.exercise_id, p.exercise_name, p.session_id, p.session_date, p.session_started_at, p.best_est_1rm
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
    select m.exercise_id, m.exercise_name, m.session_date, m.session_started_at, m.session_id, m.best_est_1rm,
           row_number() over (
             partition by m.exercise_id
             order by m.session_date desc, m.session_started_at desc, m.session_id desc
           ) as rn
    from mine m
    join top_lifts t on t.exercise_id = m.exercise_id
  )
  select r.exercise_id, r.exercise_name, r.session_date, r.best_est_1rm
  from ranked r
  where r.rn <= greatest(2, least(p_points, 52))
  order by r.exercise_id, r.session_date, r.session_started_at, r.session_id;
$$;

create or replace function public.recent_records(p_limit integer default 6)
returns table(exercise_id uuid, exercise_name text, session_id uuid, session_date date, kind text, value numeric, previous numeric)
language sql
stable
set search_path = 'public'
as $$
  with p as (
    select exercise_id, exercise_name, session_id, session_date, session_started_at,
           best_est_1rm, top_weight,
           max(best_est_1rm) over w as prev_e1rm,
           max(top_weight)   over w as prev_top
    from v_exercise_progression
    window w as (
      partition by exercise_id
      order by session_date, session_started_at, session_id
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
  order by session_date desc, session_started_at desc, exercise_name
  limit greatest(1, least(p_limit, 50));
$$;

-- 6. Ended early ------------------------------------------------------------

alter table public.session_exercise add column ended_at timestamptz;

-- Training the way it's done: a past workout started again, a workout kept
-- as a template, and the date of a lift's last session for the watch's
-- targets (a lift back after weeks off starts lighter: progression.ts).

-- What a workout's exercises did, for repeating it or keeping it: its
-- straight sets (not warm-ups, drops or rest-pause) and their rep span.
-- "Do it again" and "Save as template" both plan from it: as many sets as
-- were done, in the reps they were done in, unless the workout had a plan.

-- Starts a new workout from a past one: the exercises that were done (all
-- of them, if none were), in order, with that workout's sets and reps as
-- the targets. Off-plan, like any start that isn't a program day: it never
-- counts toward a program. One workout at a time, as start_session: one
-- already under way is returned instead.
create or replace function public.repeat_session(p_session uuid, p_date date default null)
returns uuid
language plpgsql
set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_template uuid;
  v_title text;
  v_session uuid;
  v_any_logged boolean;
begin
  if v_user is null then
    raise exception 'not signed in';
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

  select s.template_id, s.title into v_template, v_title
  from public.session s
  where s.id = p_session and s.user_id = v_user;
  if not found then
    raise exception 'session not found';
  end if;

  select exists (
    select 1
    from public.session_exercise se
    join public.set st on st.session_exercise_id = se.id
    where se.session_id = p_session and st.reps > 0
  ) into v_any_logged;

  insert into public.session (user_id, template_id, title, date)
  values (v_user, v_template, v_title, coalesce(p_date, current_date))
  returning id into v_session;

  insert into public.session_exercise (
    user_id, session_id, exercise_id, position, note, superset,
    target_sets, target_rep_range, rest_seconds
  )
  select v_user, v_session, se.exercise_id, se.position, se.note, se.superset,
         coalesce(least(20, nullif(w.straight, 0)), se.target_sets),
         coalesce(
           se.target_rep_range,
           case when w.lo is null then null
                when w.lo = w.hi then w.lo::text
                else w.lo::text || '-' || w.hi::text end
         ),
         se.rest_seconds
  from public.session_exercise se
  cross join lateral (
    select count(*) filter (where st.reps > 0)::int as logged,
           count(*) filter (where st.reps > 0 and not st.is_warmup and st.kind is null)::int as straight,
           min(st.reps) filter (where st.reps > 0 and not st.is_warmup and st.kind is null) as lo,
           max(st.reps) filter (where st.reps > 0 and not st.is_warmup and st.kind is null) as hi
    from public.set st
    where st.session_exercise_id = se.id
  ) w
  where se.session_id = p_session
    and se.user_id = v_user
    and (not v_any_logged or w.logged > 0)
  order by se.position;

  return v_session;
end;
$$;

revoke all on function public.repeat_session(uuid, date) from public, anon;
grant execute on function public.repeat_session(uuid, date) to authenticated, service_role;

-- Keeps a workout as a template at the end of the lifter's list: the
-- exercises that were done, in order, each with the sets and reps done (or
-- the workout's own targets, where it had them), its rest and its note.
create or replace function public.template_from_session(p_session uuid, p_name text)
returns uuid
language plpgsql
set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_template uuid;
  v_any_logged boolean;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  perform 1 from public.session s where s.id = p_session and s.user_id = v_user;
  if not found then
    raise exception 'session not found';
  end if;

  select exists (
    select 1
    from public.session_exercise se
    join public.set st on st.session_exercise_id = se.id
    where se.session_id = p_session and st.reps > 0
  ) into v_any_logged;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('templates:' || v_user::text, 0));
  insert into public.workout_template (user_id, name, position)
  values (
    v_user,
    left(btrim(p_name), 120),
    coalesce((select max(t.position) + 1 from public.workout_template t where t.user_id = v_user), 0)
  )
  returning id into v_template;

  insert into public.template_exercise (
    user_id, template_id, exercise_id, position, note, superset,
    target_sets, target_rep_range, rest_seconds
  )
  select v_user, v_template, se.exercise_id, se.position, se.note, se.superset,
         greatest(1, least(20, coalesce(nullif(w.straight, 0), se.target_sets, 3))),
         coalesce(
           se.target_rep_range,
           case when w.lo is null then null
                when w.lo = w.hi then w.lo::text
                else w.lo::text || '-' || w.hi::text end
         ),
         se.rest_seconds
  from public.session_exercise se
  cross join lateral (
    select count(*) filter (where st.reps > 0)::int as logged,
           count(*) filter (where st.reps > 0 and not st.is_warmup and st.kind is null)::int as straight,
           min(st.reps) filter (where st.reps > 0 and not st.is_warmup and st.kind is null) as lo,
           max(st.reps) filter (where st.reps > 0 and not st.is_warmup and st.kind is null) as hi
    from public.set st
    where st.session_exercise_id = se.id
  ) w
  where se.session_id = p_session
    and se.user_id = v_user
    and (not v_any_logged or w.logged > 0)
  order by se.position;

  return v_template;
end;
$$;

revoke all on function public.template_from_session(uuid, text) from public, anon;
grant execute on function public.template_from_session(uuid, text) to authenticated, service_role;

-- The watch's last-time read gains the session's date, as the app's has
-- (last_performances), so a lift back after weeks off starts lighter there
-- too. A new column changes the result type, so it's dropped and made again
-- in this one transaction; the service role alone calls it, as before.
drop function if exists public.watch_last_performances(uuid, uuid[], uuid);
create function public.watch_last_performances(p_user uuid, p_exercise_ids uuid[], p_exclude_session uuid default null)
returns table(exercise_id uuid, set_number integer, weight_kg numeric, reps integer, rpe numeric, session_date date)
language sql
stable
set search_path to ''
as $$
  with latest as (
    select distinct on (w.exercise_id) w.exercise_id, w.session_id
    from public.v_working_set w
    join public.session s on s.id = w.session_id
    where w.user_id = p_user
      and w.exercise_id = any(p_exercise_ids)
      and (p_exclude_session is null or w.session_id <> p_exclude_session)
    order by w.exercise_id, w.session_date desc, s.created_at desc, w.session_id desc
  )
  select w.exercise_id, w.set_number, w.weight_kg, w.reps, w.rpe, w.session_date
  from public.v_working_set w
  join latest l on l.exercise_id = w.exercise_id and l.session_id = w.session_id
  order by w.exercise_id, w.set_number;
$$;

revoke all on function public.watch_last_performances(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.watch_last_performances(uuid, uuid[], uuid) to service_role;

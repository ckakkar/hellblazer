-- Multi-step writes as single transactions. Each of these used to be several
-- PostgREST calls from a Server Action, so a failure halfway could leave a
-- session with no exercises, a preset with no program, no active program, or
-- two rows sharing a position. As functions, each runs all-or-nothing.
--
-- All are security invoker: they run as the caller, so RLS still applies.
-- The one exception to "the caller is auth.uid()" is start_session's p_user,
-- for the Apple Watch API (service role, no user JWT): it's only honoured
-- when there's no signed-in user, and RLS would reject a mismatch anyway.

-- A session from a template, a program day, or nothing (freeform), with the
-- template's exercises copied in. Returns the new session's id.
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
    insert into public.session_exercise (user_id, session_id, exercise_id, position, note)
    select v_user, v_session, te.exercise_id, te.position, te.note
    from public.template_exercise te
    where te.template_id = v_template and te.user_id = v_user
    order by te.position;
  end if;

  return v_session;
end;
$$;

-- A program with its days, optionally made the active one.
create or replace function public.create_program(
  p_name text,
  p_duration_weeks int,
  p_start_date date,
  p_template_ids uuid[],
  p_set_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_program uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_template_ids, '{}')) as t(id)
    where not exists (
      select 1 from public.workout_template w where w.id = t.id and w.user_id = v_user
    )
  ) then
    raise exception 'template not found';
  end if;

  if p_set_active then
    update public.program set is_active = false where user_id = v_user and is_active;
  end if;

  insert into public.program (user_id, name, duration_weeks, start_date, is_active)
  values (v_user, p_name, p_duration_weeks, p_start_date, p_set_active)
  returning id into v_program;

  insert into public.program_day (user_id, program_id, template_id, position)
  select v_user, v_program, t.id, (t.ord - 1)::int
  from unnest(coalesce(p_template_ids, '{}')) with ordinality as t(id, ord);

  return v_program;
end;
$$;

-- Make a program the active one (starting it today if it never started), or
-- stop it. Switching is one step, so there's never a moment with none.
create or replace function public.set_active_program(p_id uuid, p_active boolean, p_today date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_active then
    update public.program set is_active = false
    where user_id = v_user and is_active and id <> p_id;
    update public.program
    set is_active = true, start_date = coalesce(start_date, p_today)
    where id = p_id and user_id = v_user;
  else
    update public.program set is_active = false where id = p_id and user_id = v_user;
  end if;
end;
$$;

-- The clutter repeated preset loads leave: inactive programs never trained,
-- then templates in no program and no session. Logged work is always kept.
create or replace function public.purge_abandoned_templates()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  delete from public.program p
  where p.user_id = v_user
    and not p.is_active
    and not exists (select 1 from public.session s where s.program_id = p.id);
  delete from public.workout_template t
  where t.user_id = v_user
    and not exists (select 1 from public.program_day d where d.template_id = t.id)
    and not exists (select 1 from public.session s where s.template_id = t.id);
end;
$$;

-- A starter routine (src/lib/presets.ts) as templates plus an active program
-- starting today, replacing the previous split. p_days:
--   [{ "name", "dayLabel", "exercises": [{ "name", "sets", "reps", "note" }] }]
-- Exercises are matched by name against the library the lifter can see; a
-- name that doesn't resolve is skipped (its position stays empty).
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

  return v_program;
end;
$$;

-- Reorder: swap a template exercise with its neighbour. If earlier writes
-- left two rows on one position, the list is renumbered first, so the swap
-- always moves something.
create or replace function public.move_template_exercise(p_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent uuid;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  select template_id into v_parent from public.template_exercise where id = p_id;
  if not found then
    return;
  end if;
  if exists (
    select 1 from public.template_exercise where template_id = v_parent
    group by position having count(*) > 1
  ) then
    update public.template_exercise t set position = o.rn
    from (
      select id, (row_number() over (order by position, id) - 1)::int as rn
      from public.template_exercise where template_id = v_parent
    ) o
    where t.id = o.id;
  end if;

  select position into v_pos from public.template_exercise where id = p_id;
  select id, position into v_other, v_other_pos
  from public.template_exercise
  where template_id = v_parent
    and case when p_direction = 'up' then position < v_pos else position > v_pos end
  order by case when p_direction = 'up' then -position else position end
  limit 1;
  if v_other is null then
    return;
  end if;
  update public.template_exercise set position = v_other_pos where id = p_id;
  update public.template_exercise set position = v_pos where id = v_other;
end;
$$;

-- The same for a program's days.
create or replace function public.move_program_day(p_id uuid, p_direction text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent uuid;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  select program_id into v_parent from public.program_day where id = p_id;
  if not found then
    return;
  end if;
  if exists (
    select 1 from public.program_day where program_id = v_parent
    group by position having count(*) > 1
  ) then
    update public.program_day d set position = o.rn
    from (
      select id, (row_number() over (order by position, id) - 1)::int as rn
      from public.program_day where program_id = v_parent
    ) o
    where d.id = o.id;
  end if;

  select position into v_pos from public.program_day where id = p_id;
  select id, position into v_other, v_other_pos
  from public.program_day
  where program_id = v_parent
    and case when p_direction = 'up' then position < v_pos else position > v_pos end
  order by case when p_direction = 'up' then -position else position end
  limit 1;
  if v_other is null then
    return;
  end if;
  update public.program_day set position = v_other_pos where id = p_id;
  update public.program_day set position = v_pos where id = v_other;
end;
$$;

revoke execute on function public.start_session(uuid, uuid, date, uuid) from public, anon;
revoke execute on function public.create_program(text, int, date, uuid[], boolean) from public, anon;
revoke execute on function public.set_active_program(uuid, boolean, date) from public, anon;
revoke execute on function public.purge_abandoned_templates() from public, anon;
revoke execute on function public.load_preset(text, int, date, jsonb) from public, anon;
revoke execute on function public.move_template_exercise(uuid, text) from public, anon;
revoke execute on function public.move_program_day(uuid, text) from public, anon;

grant execute on function public.start_session(uuid, uuid, date, uuid) to authenticated, service_role;
grant execute on function public.create_program(text, int, date, uuid[], boolean) to authenticated;
grant execute on function public.set_active_program(uuid, boolean, date) to authenticated;
grant execute on function public.purge_abandoned_templates() to authenticated;
grant execute on function public.load_preset(text, int, date, jsonb) to authenticated;
grant execute on function public.move_template_exercise(uuid, text) to authenticated;
grant execute on function public.move_program_day(uuid, text) to authenticated;

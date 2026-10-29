-- Reading the deleted row FOR UPDATE needs an update policy, which
-- deleted_session deliberately has none of, so the restore found nothing.
-- It reads it plainly; a second restore of the same workout stops at the
-- session already being back.
create or replace function public.restore_session(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.deleted_session;
  v_session public.session;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  select * into v_row from public.deleted_session d where d.id = p_id and d.user_id = v_user;
  if not found then
    raise exception 'deleted workout not found';
  end if;

  v_session := jsonb_populate_record(null::public.session, v_row.payload -> 'session');
  if v_session.user_id <> v_user then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.session s where s.id = v_session.id) then
    raise exception 'already restored';
  end if;
  -- What it pointed at may have gone since; the workout comes back without it.
  if v_session.template_id is not null and not exists (
    select 1 from public.workout_template t where t.id = v_session.template_id and t.user_id = v_user
  ) then
    v_session.template_id := null;
  end if;
  if v_session.program_id is not null and not exists (
    select 1 from public.program p where p.id = v_session.program_id and p.user_id = v_user
  ) then
    v_session.program_id := null;
  end if;
  if v_session.program_day_id is not null and not exists (
    select 1 from public.program_day pd where pd.id = v_session.program_day_id and pd.user_id = v_user
  ) then
    v_session.program_day_id := null;
  end if;
  -- A custom exercise deleted since can't be put back under its sets.
  if exists (
    select 1 from jsonb_array_elements(v_row.payload -> 'exercises') e
    where not exists (select 1 from public.exercise x where x.id = (e ->> 'exercise_id')::uuid)
  ) then
    raise exception 'exercise missing';
  end if;

  insert into public.session select (v_session).*;
  insert into public.session_exercise
  select (jsonb_populate_record(null::public.session_exercise, e)).*
  from jsonb_array_elements(v_row.payload -> 'exercises') e;
  insert into public."set"
  select (jsonb_populate_record(null::public."set", e)).*
  from jsonb_array_elements(v_row.payload -> 'sets') e;

  delete from public.deleted_session where id = p_id;
  return v_session.id;
end;
$$;

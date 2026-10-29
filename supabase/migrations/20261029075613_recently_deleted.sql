-- ── Recently deleted (S08) ──────────────────────────────────────────────────
-- A deleted workout is kept whole for 30 days: the session, its exercises
-- and its sets as they were, so restoring brings back the same rows (ids,
-- times and all) and every record and chart with them. Nothing reads from
-- here but the Recently deleted list, so a deleted workout counts nowhere.
create table public.deleted_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  title text,
  session_date date not null,
  working_sets integer not null default 0,
  deleted_at timestamptz not null default now(),
  payload jsonb not null
);
create index deleted_session_user_idx on public.deleted_session (user_id, deleted_at desc);

alter table public.deleted_session enable row level security;
create policy "deleted_session: read own" on public.deleted_session
  for select to authenticated using (user_id = (select auth.uid()));
create policy "deleted_session: insert own" on public.deleted_session
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "deleted_session: delete own" on public.deleted_session
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.deleted_session from anon;

create function public.trash_session(p_session uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_title text;
  v_date date;
  v_sets integer;
  v_payload jsonb;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  select s.title, s.date into v_title, v_date
  from public.session s
  where s.id = p_session and s.user_id = v_user
  for update;
  if not found then
    raise exception 'session not found';
  end if;

  select jsonb_build_object(
    'session', (select to_jsonb(s) from public.session s where s.id = p_session),
    'exercises', coalesce((
      select jsonb_agg(to_jsonb(se) order by se.position)
      from public.session_exercise se where se.session_id = p_session
    ), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(to_jsonb(st) order by st.set_number)
      from public."set" st
      join public.session_exercise se on se.id = st.session_exercise_id
      where se.session_id = p_session
    ), '[]'::jsonb)
  ) into v_payload;
  select count(*) into v_sets
  from public."set" st
  join public.session_exercise se on se.id = st.session_exercise_id
  where se.session_id = p_session and not st.is_warmup;

  insert into public.deleted_session (user_id, session_id, title, session_date, working_sets, payload)
  values (v_user, p_session, v_title, v_date, v_sets, v_payload)
  returning id into v_id;
  delete from public.session where id = p_session and user_id = v_user;
  -- Anything past its 30 days goes as the next one comes in.
  delete from public.deleted_session where user_id = v_user and deleted_at < now() - interval '30 days';
  return v_id;
end;
$$;

create function public.restore_session(p_id uuid)
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
  select * into v_row from public.deleted_session d where d.id = p_id and d.user_id = v_user for update;
  if not found then
    raise exception 'deleted workout not found';
  end if;

  v_session := jsonb_populate_record(null::public.session, v_row.payload -> 'session');
  if v_session.user_id <> v_user then
    raise exception 'not allowed';
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

-- The daily cron clears what's past its 30 days for everyone.
create function public.purge_deleted_sessions()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.deleted_session where deleted_at < now() - interval '30 days' returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.trash_session(uuid) from public, anon;
revoke execute on function public.restore_session(uuid) from public, anon;
revoke execute on function public.purge_deleted_sessions() from public, anon, authenticated;
grant execute on function public.trash_session(uuid) to authenticated;
grant execute on function public.restore_session(uuid) to authenticated;
grant execute on function public.purge_deleted_sessions() to service_role;

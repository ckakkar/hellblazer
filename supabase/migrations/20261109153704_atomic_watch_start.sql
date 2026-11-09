-- An offline watch start must not adopt a phone workout opened between its
-- live-workout read and start_session. Keep the check and the watch's clock
-- under the same lock as web starts, in the same transaction as the start.
create function public.start_watch_session(
  p_template_id uuid default null,
  p_program_day_id uuid default null,
  p_date date default null,
  p_user uuid default null,
  p_started_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_user uuid := coalesce(v_caller, p_user);
  v_session uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if v_caller is not null and p_user is not null and p_user <> v_caller then
    raise exception 'not allowed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('start_session:' || v_user::text, 0));
  if p_started_at is not null then
    -- Recheck a lost reply under the lock too: simultaneous retries of an
    -- old workout (already outside the live window) must return one row.
    select s.id into v_session from public.session s
    where s.user_id = v_user and s.created_at = p_started_at
    order by s.id limit 1;
    if found then
      return v_session;
    end if;
    if exists (
      select 1 from public.session s
      where s.user_id = v_user and s.finished_at is null
        and s.created_at > now() - interval '6 hours'
    ) then
      return null;
    end if;
  end if;

  -- Advisory transaction locks are re-entrant; the existing function
  -- remains the sole source of the template/program instantiation rules.
  v_session := public.start_session(p_template_id, p_program_day_id, p_date, v_user);
  if p_started_at is not null then
    update public.session set created_at = p_started_at
    where id = v_session and user_id = v_user;
  end if;
  return v_session;
end;
$$;

revoke execute on function public.start_watch_session(uuid, uuid, date, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.start_watch_session(uuid, uuid, date, uuid, timestamptz) to service_role;

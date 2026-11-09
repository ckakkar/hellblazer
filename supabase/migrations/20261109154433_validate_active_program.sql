-- A missing, deleted or foreign target must not turn off the caller's
-- current program. Validate and hold the target before changing any rows;
-- the lock also serializes switches from two devices belonging to one user.
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('programs:' || v_user::text, 0));
  perform 1 from public.program where id = p_id and user_id = v_user for update;
  if not found then
    raise exception 'program not found';
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

revoke execute on function public.set_active_program(uuid, boolean, date) from public, anon;
grant execute on function public.set_active_program(uuid, boolean, date) to authenticated;

-- ── Hands-free sets that can't double (R11) ────────────────────────────────
-- Siri and the Lock Screen send an id per command. Each set is inserted
-- under a lock on its exercise, numbered after the last one there, and a
-- set whose id is already in comes back as it is, so a retry after a lost
-- reply logs nothing twice and two commands at once get their own numbers.
-- Called by the device API with the service role and p_user (as
-- start_session is), or by the lifter themselves.
create function public.log_sets(p_rows jsonb, p_user uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_user uuid := coalesce(v_caller, p_user);
  v_row jsonb;
  v_id uuid;
  v_se uuid;
  v_number integer;
  v_existing public."set";
  v_out jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if v_caller is not null and p_user is not null and p_user <> v_caller then
    raise exception 'not allowed';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_id := (v_row ->> 'id')::uuid;
    v_se := (v_row ->> 'session_exercise_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('set:' || v_se::text, 0));
    select * into v_existing from public."set" s where s.id = v_id;
    if found then
      if v_existing.user_id <> v_user then
        raise exception 'conflict';
      end if;
      v_out := v_out || jsonb_build_object('id', v_existing.id, 'set_number', v_existing.set_number, 'existed', true);
      continue;
    end if;
    select coalesce(max(s.set_number), 0) + 1 into v_number
    from public."set" s where s.session_exercise_id = v_se;
    insert into public."set" (id, user_id, session_exercise_id, set_number, weight_kg, reps, rpe, is_warmup, kind, is_completed)
    values (
      v_id, v_user, v_se, v_number,
      (v_row ->> 'weight_kg')::numeric,
      (v_row ->> 'reps')::integer,
      (v_row ->> 'rpe')::numeric,
      coalesce((v_row ->> 'is_warmup')::boolean, false),
      v_row ->> 'kind',
      true
    );
    v_out := v_out || jsonb_build_object('id', v_id, 'set_number', v_number, 'existed', false);
  end loop;
  return v_out;
end;
$$;

revoke execute on function public.log_sets(jsonb, uuid) from public, anon;
grant execute on function public.log_sets(jsonb, uuid) to authenticated, service_role;

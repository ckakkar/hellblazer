-- Swapping a movement mid-workout changes that workout only; the template
-- (every workout to come) is changed on the Templates page. Sets already
-- logged belong to the movement they were done on: when there are some, the
-- new movement goes in right after it (same targets, rest and superset) and
-- the old one is ended there, so its history and records stay true.
-- Returns {"id": the row to log against, "split": whether a new row was made}.
create or replace function public.swap_session_exercise(p_id uuid, p_exercise uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.session_exercise%rowtype;
  v_new uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  select * into v_row from public.session_exercise se
  where se.id = p_id and se.user_id = v_user
  for update;
  if not found then
    raise exception 'session exercise not found';
  end if;

  if not exists (select 1 from public.set s where s.session_exercise_id = p_id) then
    update public.session_exercise se set exercise_id = p_exercise where se.id = p_id;
    return jsonb_build_object('id', p_id, 'split', false);
  end if;

  -- The rows after it move down one, under a lock so two edits can't
  -- interleave their positions.
  perform 1 from public.session_exercise se where se.session_id = v_row.session_id for update;
  update public.session_exercise se set position = se.position + 1
  where se.session_id = v_row.session_id and se.position > v_row.position;
  insert into public.session_exercise
    (user_id, session_id, exercise_id, position, superset, target_sets, target_rep_range, rest_seconds, note)
  values
    (v_user, v_row.session_id, p_exercise, v_row.position + 1, v_row.superset,
     v_row.target_sets, v_row.target_rep_range, v_row.rest_seconds, v_row.note)
  returning id into v_new;
  update public.session_exercise se set ended_at = coalesce(se.ended_at, now()) where se.id = p_id;
  return jsonb_build_object('id', v_new, 'split', true);
end;
$$;

revoke all on function public.swap_session_exercise(uuid, uuid) from public, anon;
grant execute on function public.swap_session_exercise(uuid, uuid) to authenticated, service_role;

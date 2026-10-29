-- ── Appends that can't collide (R08) ───────────────────────────────────────
-- Adding an exercise or a day read the last position and wrote one past it,
-- so two adds at once could share a place. A row inserted with a negative
-- position now goes after the last one, worked out under a lock on its
-- parent, so adds queue instead of colliding.
create function public.append_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.position >= 0 then
    return new;
  end if;
  if tg_table_name = 'session_exercise' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('session_exercise:' || new.session_id::text, 0));
    select coalesce(max(x.position), -1) + 1 into new.position
    from public.session_exercise x where x.session_id = new.session_id;
  elsif tg_table_name = 'template_exercise' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template_exercise:' || new.template_id::text, 0));
    select coalesce(max(x.position), -1) + 1 into new.position
    from public.template_exercise x where x.template_id = new.template_id;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_day:' || new.program_id::text, 0));
    select coalesce(max(x.position), -1) + 1 into new.position
    from public.program_day x where x.program_id = new.program_id;
  end if;
  return new;
end;
$$;

create trigger session_exercise_append before insert on public.session_exercise
  for each row execute function public.append_position();
create trigger template_exercise_append before insert on public.template_exercise
  for each row execute function public.append_position();
create trigger program_day_append before insert on public.program_day
  for each row execute function public.append_position();

-- Superset links touch several rows; they now change together or not at all.
create function public.apply_superset_changes(p_table text, p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_table = 'session_exercise' then
    update public.session_exercise t
    set superset = (c ->> 'superset')::integer
    from jsonb_array_elements(p_changes) c
    where t.id = (c ->> 'id')::uuid and t.user_id = (select auth.uid());
  elsif p_table = 'template_exercise' then
    update public.template_exercise t
    set superset = (c ->> 'superset')::integer
    from jsonb_array_elements(p_changes) c
    where t.id = (c ->> 'id')::uuid and t.user_id = (select auth.uid());
  else
    raise exception 'not a superset table';
  end if;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_changes) then
    raise exception 'superset rows not found';
  end if;
end;
$$;

-- Restarting a block clears its skips and moves its start in one step.
create function public.restart_program(p_id uuid, p_today date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  delete from public.program_skip where program_id = p_id and user_id = (select auth.uid());
  update public.program
  set start_date = p_today, paused_at = null, pauses = '[]'::jsonb, restarted_at = now()
  where id = p_id and user_id = (select auth.uid());
  if not found then
    raise exception 'program not found';
  end if;
end;
$$;

revoke execute on function public.apply_superset_changes(text, jsonb) from public, anon;
revoke execute on function public.restart_program(uuid, date) from public, anon;
grant execute on function public.apply_superset_changes(text, jsonb) to authenticated;
grant execute on function public.restart_program(uuid, date) to authenticated;

-- Moves must share the APPEND trigger's parent lock: two moves that read
-- the same neighbour before either writes could otherwise duplicate its
-- position, and an append could choose a position midway through a swap.
-- Position calculations and duplicate-position repair remain unchanged.
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template_exercise:' || v_parent::text, 0));
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
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('program_day:' || v_parent::text, 0));
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

revoke execute on function public.move_template_exercise(uuid, text) from public, anon;
revoke execute on function public.move_program_day(uuid, text) from public, anon;
grant execute on function public.move_template_exercise(uuid, text) to authenticated;
grant execute on function public.move_program_day(uuid, text) to authenticated;

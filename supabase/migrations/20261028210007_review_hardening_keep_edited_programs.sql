-- Folded into 20261028205907_review_hardening.sql as well: a starter program
-- with a day the lifter changed is theirs, so the purge keeps it (and its
-- untouched days with it).
create or replace function public.purge_abandoned_templates()
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_programs int;
  v_templates int;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  delete from public.program p
  where p.user_id = v_user
    and p.from_preset
    and not p.is_active
    and not exists (select 1 from public.session s where s.program_id = p.id)
    and not exists (
      select 1 from public.program_day d
      join public.workout_template t on t.id = d.template_id
      where d.program_id = p.id and not t.from_preset
    );
  get diagnostics v_programs = row_count;
  delete from public.workout_template t
  where t.user_id = v_user and t.from_preset
    and not exists (select 1 from public.program_day d where d.template_id = t.id)
    and not exists (select 1 from public.session s where s.template_id = t.id);
  get diagnostics v_templates = row_count;
  return v_programs + v_templates;
end;
$$;

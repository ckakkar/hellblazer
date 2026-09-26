-- Parent and child rows must belong to the same lifter. RLS checks a child
-- row's own user_id, but the foreign keys only named the parent's id, so a
-- signed-in lifter who learned another's session id could attach exercises
-- or sets to it (invisible to the owner, but in their data graph). Each
-- reference now names (id, user_id), so the database itself refuses a parent
-- that isn't the child's owner's. Nullable references keep their
-- ON DELETE SET NULL, clearing only the id column.
--
-- Library exercises are shared (user_id null), which a composite key can't
-- express, so a trigger checks that an exercise is global or the lifter's own.
--
-- Verified before applying: no existing row references another user's parent.

alter table public.workout_template add constraint workout_template_id_user_key unique (id, user_id);
alter table public.program add constraint program_id_user_key unique (id, user_id);
alter table public.program_day add constraint program_day_id_user_key unique (id, user_id);
alter table public.session add constraint session_id_user_key unique (id, user_id);
alter table public.session_exercise add constraint session_exercise_id_user_key unique (id, user_id);

alter table public.template_exercise
  drop constraint template_exercise_template_id_fkey,
  add constraint template_exercise_template_id_fkey
    foreign key (template_id, user_id) references public.workout_template (id, user_id) on delete cascade;

alter table public.session
  drop constraint session_template_id_fkey,
  add constraint session_template_id_fkey
    foreign key (template_id, user_id) references public.workout_template (id, user_id) on delete set null (template_id),
  drop constraint session_program_id_fkey,
  add constraint session_program_id_fkey
    foreign key (program_id, user_id) references public.program (id, user_id) on delete set null (program_id);

alter table public.session_exercise
  drop constraint session_exercise_session_id_fkey,
  add constraint session_exercise_session_id_fkey
    foreign key (session_id, user_id) references public.session (id, user_id) on delete cascade;

alter table public."set"
  drop constraint set_session_exercise_id_fkey,
  add constraint set_session_exercise_id_fkey
    foreign key (session_exercise_id, user_id) references public.session_exercise (id, user_id) on delete cascade;

alter table public.program_day
  drop constraint program_day_program_id_fkey,
  add constraint program_day_program_id_fkey
    foreign key (program_id, user_id) references public.program (id, user_id) on delete cascade,
  drop constraint program_day_template_id_fkey,
  add constraint program_day_template_id_fkey
    foreign key (template_id, user_id) references public.workout_template (id, user_id) on delete set null (template_id);

alter table public.program_skip
  drop constraint program_skip_program_id_fkey,
  add constraint program_skip_program_id_fkey
    foreign key (program_id, user_id) references public.program (id, user_id) on delete cascade,
  drop constraint program_skip_program_day_id_fkey,
  add constraint program_skip_program_day_id_fkey
    foreign key (program_day_id, user_id) references public.program_day (id, user_id) on delete set null (program_day_id);

-- An exercise used in a template or session must be in the library or the
-- lifter's own.
create function public.check_exercise_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.exercise e
    where e.id = new.exercise_id and (e.user_id is null or e.user_id = new.user_id)
  ) then
    raise exception 'exercise not found' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_exercise_owner() from public, anon, authenticated;

create trigger template_exercise_exercise_owner
  before insert or update of exercise_id, user_id on public.template_exercise
  for each row execute function public.check_exercise_owner();
create trigger session_exercise_exercise_owner
  before insert or update of exercise_id, user_id on public.session_exercise
  for each row execute function public.check_exercise_owner();

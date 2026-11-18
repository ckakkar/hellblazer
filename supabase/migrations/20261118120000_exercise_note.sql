-- ── A lifter's own note on a movement ──────────────────────────────────────
-- "Seat 4, pin 7": kept with the exercise, not with a workout or a template,
-- so it's there whenever that movement comes up, an empty start included.
-- One note per lifter and exercise; clearing it deletes the row. A note on a
-- custom exercise goes with it if the exercise is deleted (a retired one
-- keeps its note). Wiping history leaves notes alone (they aren't history);
-- deleting the account removes them with everything else.
create table public.exercise_note (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 200 and note = btrim(note)),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- For the cascade when a custom exercise is deleted.
create index exercise_note_exercise_id_idx on public.exercise_note (exercise_id);

alter table public.exercise_note enable row level security;

-- Your own notes only, and only on an exercise you can see (the shared
-- library or your own): the exercise's own row-level security decides that.
create policy "exercise_note_all" on public.exercise_note for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercise e where e.id = exercise_id)
  );

revoke all on public.exercise_note from anon;
grant select, insert, update, delete on public.exercise_note to authenticated;

-- A changed note says when.
create or replace function public.exercise_note_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger exercise_note_touch
  before update on public.exercise_note
  for each row execute function public.exercise_note_touch();

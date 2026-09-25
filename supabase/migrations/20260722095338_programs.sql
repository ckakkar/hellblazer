-- A training block / mesocycle: a named plan the user runs for a set number of
-- weeks, scheduling their templates across a weekly rotation.
create table program (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  notes text,
  duration_weeks int not null default 8 check (duration_weeks between 1 and 52),
  start_date date,                       -- null = not started yet
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Ordered training days within a program's week, each pointing at a template.
create table program_day (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  program_id uuid not null references program on delete cascade,
  template_id uuid references workout_template on delete set null,
  position int not null default 0,
  weekday int check (weekday between 0 and 6),  -- optional fixed weekday (0=Mon)
  label text
);

-- Link a logged session back to the program it belongs to.
alter table session add column program_id uuid references program on delete set null;

-- At most one active program per user.
create unique index one_active_program_per_user on program (user_id) where is_active;
create index idx_program_user on program (user_id);
create index idx_program_day_user on program_day (user_id);
create index idx_program_day_program on program_day (program_id, position);
create index idx_session_program on session (program_id);

-- RLS
alter table program enable row level security;
alter table program_day enable row level security;

create policy "program_all" on program for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "program_day_all" on program_day for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

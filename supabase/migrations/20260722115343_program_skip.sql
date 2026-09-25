-- A skipped programmed day. Advances the weekly rotation without creating an
-- empty session in history.
create table program_skip (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  program_id uuid not null references program on delete cascade,
  program_day_id uuid references program_day on delete set null,
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index idx_program_skip_program on program_skip (program_id, date);

alter table program_skip enable row level security;
create policy "program_skip_all" on program_skip for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table program_skip;

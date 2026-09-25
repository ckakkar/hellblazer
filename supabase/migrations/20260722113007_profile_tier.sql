-- Per-user profile: holds the Baki strength tier (character key) and the last
-- evaluation's rationale. One row per user.
create table profile (
  user_id uuid primary key references auth.users on delete cascade,
  tier text,
  tier_rationale text,
  tier_evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table profile enable row level security;
create policy "profile_all" on profile for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

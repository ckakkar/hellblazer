create table if not exists push_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  timezone text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscription enable row level security;

create policy "push_subscription_select_own"
  on push_subscription for select using (auth.uid() = user_id);
create policy "push_subscription_insert_own"
  on push_subscription for insert with check (auth.uid() = user_id);
create policy "push_subscription_update_own"
  on push_subscription for update using (auth.uid() = user_id);
create policy "push_subscription_delete_own"
  on push_subscription for delete using (auth.uid() = user_id);

create index if not exists push_subscription_user_id_idx
  on push_subscription (user_id);

-- Preferred local hour (0-23) for the daily workout reminder; null = off.
alter table profile add column if not exists reminder_hour int;
alter table profile
  add constraint profile_reminder_hour_range
  check (reminder_hour is null or (reminder_hour >= 0 and reminder_hour <= 23));

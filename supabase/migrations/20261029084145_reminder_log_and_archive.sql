-- ── Reminders that go out once (O01) ───────────────────────────────────────
-- The cron reserves each reminder (lifter, kind, day or week) before sending
-- it, so an overlapping or retried run can't send it twice. Service role only.
create table public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'recap')),
  period text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, period)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;


-- ── Retiring a custom exercise (P05) ───────────────────────────────────────
-- An archived exercise leaves the pickers but keeps its history.
alter table public.exercise add column archived_at timestamptz;

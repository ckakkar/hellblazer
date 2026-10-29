-- ── Widgets without alerts (P11) ────────────────────────────────────────────
-- An iPhone registers for silent pushes whether or not it allows alerts, so
-- its widgets stay fresh; `alerts` says whether reminders go to it too.
alter table public.apns_device add column alerts boolean not null default true;

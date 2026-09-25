-- iOS app: APNs device tokens for push reminders, and Sign in with Apple
-- refresh tokens (kept only so they can be revoked when an account is deleted,
-- which App Store rules require).

create table public.apns_device (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  timezone text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint apns_device_token_key unique (token)
);
create index apns_device_user_id_idx on public.apns_device (user_id);

alter table public.apns_device enable row level security;

create policy "apns_device: read own" on public.apns_device
  for select to authenticated using (user_id = (select auth.uid()));
create policy "apns_device: delete own" on public.apns_device
  for delete to authenticated using (user_id = (select auth.uid()));
-- No insert/update policy: writes go through claim_apns_device(), which can
-- move a token to whoever is signed in on that phone now.

create function public.claim_apns_device(p_token text, p_timezone text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  if p_token !~ '^[0-9a-f]{64,200}$' then
    raise exception 'invalid device token';
  end if;
  insert into public.apns_device (user_id, token, timezone)
  values ((select auth.uid()), p_token, left(p_timezone, 64))
  on conflict (token) do update
    set user_id = excluded.user_id,
        timezone = excluded.timezone,
        last_seen_at = now();
end;
$$;

revoke execute on function public.claim_apns_device(text, text) from public, anon;
grant execute on function public.claim_apns_device(text, text) to authenticated;

create table public.apple_token (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.apple_token enable row level security;
-- No policies on purpose: only the service role (the sign-in route and
-- account deletion) touches this table.
revoke all on public.apple_token from anon, authenticated;

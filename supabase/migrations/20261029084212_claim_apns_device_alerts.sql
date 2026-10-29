-- p_alerts: whether reminders go to this iPhone (its widgets refresh either way).
create function public.claim_apns_device(p_token text, p_timezone text default null, p_alerts boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  if length(p_token) not between 64 and 200 or p_token !~ '^[0-9a-f]+$' then
    raise exception 'invalid device';
  end if;
  insert into public.apns_device (user_id, token, timezone, alerts)
  values ((select auth.uid()), p_token, left(p_timezone, 64), p_alerts)
  on conflict (token) do update
    set user_id = excluded.user_id,
        timezone = excluded.timezone,
        alerts = excluded.alerts,
        last_seen_at = now();
end;
$$;

alter table public.profile
  add column if not exists username text check (char_length(username) between 2 and 24);

create unique index if not exists profile_username_lower_uidx
  on public.profile (lower(username))
  where username is not null;

-- Public leaderboard: exposes only username + tier for ranked, named users.
-- Security definer bypasses per-row RLS but returns no sensitive columns.
create or replace function public.leaderboard()
returns table (username text, tier text)
language sql
security definer
set search_path = public
as $$
  select p.username, p.tier
  from public.profile p
  where p.username is not null and p.tier is not null
$$;

grant execute on function public.leaderboard() to authenticated;

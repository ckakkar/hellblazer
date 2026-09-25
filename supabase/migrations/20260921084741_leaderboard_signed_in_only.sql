-- King of the Hill is an in-app page; its data shouldn't be readable through
-- the API without signing in. Functions are executable by PUBLIC by default,
-- so revoke that as well as anon, then grant signed-in users explicitly.
revoke execute on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;

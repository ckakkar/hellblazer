-- Rank the board by lifetime working-set volume, not by tier. Return type
-- changes, so drop + recreate. Still security-definer, exposing only
-- username + tier (flavor) + total volume for named users.
drop function if exists public.leaderboard();

create function public.leaderboard()
returns table (username text, tier text, total_volume numeric)
language sql
security definer
set search_path = public
as $$
  select p.username,
         p.tier,
         coalesce(v.total_volume, 0)::numeric as total_volume
  from public.profile p
  left join (
    select s.user_id, sum(s.weight_kg * s.reps) as total_volume
    from public."set" s
    where s.is_warmup = false
    group by s.user_id
  ) v on v.user_id = p.user_id
  where p.username is not null
  order by total_volume desc
$$;

grant execute on function public.leaderboard() to authenticated;

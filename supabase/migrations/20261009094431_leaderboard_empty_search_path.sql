-- leaderboard() runs as its owner (security definer) to read every ranked
-- profile, so it resolves nothing through the caller's schemas: an empty
-- search path, with every name already schema-qualified. Built-ins come from
-- pg_catalog, which Postgres always searches first.
alter function public.leaderboard() set search_path = '';

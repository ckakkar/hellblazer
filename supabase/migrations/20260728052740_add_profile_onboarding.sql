alter table public.profile
  add column if not exists display_name text,
  add column if not exists onboarded_at timestamptz;

alter table public.profile
  drop constraint if exists profile_display_name_len;
alter table public.profile
  add constraint profile_display_name_len
  check (display_name is null or char_length(display_name) between 1 and 60);

comment on column public.profile.display_name is
  'The lifter''s own name, collected at onboarding (prefilled from the Google identity). Private — the leaderboard shows username instead.';
comment on column public.profile.onboarded_at is
  'When the lifter completed the welcome flow. Null means send them to /welcome. An explicit flag, not inferred from field completeness, since every collected field is legitimately optional.';

-- Existing lifters already have their details and a rank; don't drag them
-- back through onboarding.
update public.profile
   set onboarded_at = coalesce(onboarded_at, created_at, now())
 where onboarded_at is null;

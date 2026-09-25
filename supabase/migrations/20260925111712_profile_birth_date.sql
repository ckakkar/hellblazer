-- A full birthday instead of just a year, so age is exact. birth_year stays
-- (kept in sync on every save) for profiles that only ever gave a year.
alter table public.profile
  add column birth_date date,
  add constraint profile_birth_date_range check (birth_date > date '1900-01-01');

grant select (birth_date), insert (birth_date), update (birth_date)
  on public.profile to authenticated;

alter table public.profile
  add column if not exists sex text check (sex in ('male','female','other')),
  add column if not exists birth_year integer check (birth_year between 1900 and 2100),
  add column if not exists height_cm numeric(5,1) check (height_cm > 0 and height_cm < 300);

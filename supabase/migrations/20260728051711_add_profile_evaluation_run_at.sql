alter table public.profile
  add column if not exists evaluation_run_at timestamptz;

comment on column public.profile.evaluation_run_at is
  'When the lifter last ran a tier evaluation, regardless of whether they accepted the verdict. Drives the evaluation cooldown. Distinct from tier_evaluated_at, which stamps only on accept.';

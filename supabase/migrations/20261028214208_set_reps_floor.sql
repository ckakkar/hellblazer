-- A set has at least one rep. An empty row in the logger is a draft that
-- stays on the device until it has one; it no longer reaches the database
-- as 0 reps, where it counted toward targets and weekly sets.
alter table public.set
  add constraint set_reps_range check (reps between 1 and 999);

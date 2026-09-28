-- Rest per exercise: a template can say how long to rest after each of its
-- exercises' sets, in seconds (3 minutes for squats, 90 seconds for curls).
-- Null: the lifter's own default rest.
alter table public.template_exercise
  add column rest_seconds integer,
  add constraint template_exercise_rest_seconds_range check (rest_seconds between 15 and 600);

-- The Sunday recap push: on unless the lifter turns it off. recap_sent_on is
-- the cron's own record of the last one sent (service role only), so a
-- retried run can't send it twice.
alter table public.profile
  add column weekly_recap boolean not null default true,
  add column recap_sent_on date;

grant select (weekly_recap), insert (weekly_recap), update (weekly_recap)
  on public.profile to authenticated;

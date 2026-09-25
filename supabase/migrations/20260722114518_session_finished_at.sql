-- Mark when a session is finished so an in-progress (unfinished) workout can be
-- detected and resumed. Existing rows are treated as already finished.
alter table session add column finished_at timestamptz;
update session set finished_at = coalesce(created_at, now()) where finished_at is null;
create index idx_session_unfinished on session (user_id, created_at desc) where finished_at is null;

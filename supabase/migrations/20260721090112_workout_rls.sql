-- Enable RLS on every table
alter table exercise           enable row level security;
alter table workout_template   enable row level security;
alter table template_exercise  enable row level security;
alter table session            enable row level security;
alter table session_exercise   enable row level security;
alter table "set"              enable row level security;
alter table bodyweight_log     enable row level security;

-- exercise: shared read (global rows OR your own), write only your own.
-- auth.uid() wrapped in a subselect so the planner evaluates it once (perf best practice).
create policy "exercise_select" on exercise for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "exercise_insert" on exercise for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "exercise_update" on exercise for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercise_delete" on exercise for delete to authenticated
  using (user_id = (select auth.uid()));

-- All user-owned tables: full CRUD restricted to your own rows.
create policy "workout_template_all" on workout_template for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "template_exercise_all" on template_exercise for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "session_all" on session for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "session_exercise_all" on session_exercise for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "set_all" on "set" for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "bodyweight_log_all" on bodyweight_log for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

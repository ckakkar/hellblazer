-- Covering indexes for foreign keys the advisor flagged (joins and cascades
-- would otherwise scan).
create index if not exists idx_program_day_template on public.program_day (template_id);
create index if not exists idx_program_skip_program_day on public.program_skip (program_day_id);
create index if not exists idx_program_skip_user on public.program_skip (user_id);
create index if not exists idx_session_template on public.session (template_id);
create index if not exists idx_template_exercise_exercise on public.template_exercise (exercise_id);

-- Evaluate auth.uid() once per query, not once per row. Same rules.
alter policy push_subscription_select_own on public.push_subscription
  using ((select auth.uid()) = user_id);
alter policy push_subscription_insert_own on public.push_subscription
  with check ((select auth.uid()) = user_id);
alter policy push_subscription_update_own on public.push_subscription
  using ((select auth.uid()) = user_id);
alter policy push_subscription_delete_own on public.push_subscription
  using ((select auth.uid()) = user_id);

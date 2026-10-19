-- The iPad's live view of a workout under way on the phone or the watch
-- refreshes as sets land. Only that view subscribes to these tables (the
-- app's RealtimeSync doesn't), so the phone's logging causes no refreshes,
-- and RLS still gates what each subscriber receives.
alter publication supabase_realtime add table session_exercise;
alter publication supabase_realtime add table "set";

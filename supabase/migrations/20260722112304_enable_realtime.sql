-- Broadcast row changes for these tables so the client can live-refresh
-- server-rendered views. RLS still gates what each user receives.
-- (Deliberately excluding "set": the logger is already optimistic, and
-- per-set writes would cause needless refresh storms.)
alter publication supabase_realtime add table session;
alter publication supabase_realtime add table program;
alter publication supabase_realtime add table program_day;
alter publication supabase_realtime add table workout_template;

-- Muscle group enum (shared taxonomy for exercises + analytics)
create type muscle_group as enum (
  'chest','back','side_delt','rear_delt','front_delt','biceps','triceps',
  'quads','hamstrings','glutes','calves','abs','forearms','traps'
);

-- Shared, seedable exercise library. user_id null = global; non-null = user's custom exercise.
create table exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  primary_muscle muscle_group not null,
  secondary_muscles muscle_group[] not null default '{}',
  mechanic text check (mechanic in ('compound','isolation')),
  equipment text check (equipment in ('barbell','dumbbell','cable','machine','bodyweight','other')),
  default_rep_range text,
  created_at timestamptz not null default now()
);

-- A reusable workout template (one day of a split)
create table workout_template (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  day_label text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Ordered, prescribed exercises within a template
create table template_exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  template_id uuid not null references workout_template on delete cascade,
  exercise_id uuid not null references exercise on delete restrict,
  position int not null default 0,
  target_sets int,
  target_rep_range text,
  note text
);

-- One training session on one date (template-instantiated or freeform)
create table session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  template_id uuid references workout_template on delete set null,
  date date not null default current_date,
  title text,
  notes text,
  duration_min int,
  created_at timestamptz not null default now()
);

-- Exercises actually performed in a session
create table session_exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_id uuid not null references session on delete cascade,
  exercise_id uuid not null references exercise on delete restrict,
  position int not null default 0,
  note text
);

-- The atomic logged unit. "set" is a reserved keyword so it is always quoted.
create table "set" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  session_exercise_id uuid not null references session_exercise on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2) not null,
  reps int not null,
  rpe numeric(3,1) check (rpe >= 0 and rpe <= 10),
  is_warmup boolean not null default false,
  is_completed boolean not null default true,
  created_at timestamptz not null default now()
);

-- Optional bodyweight tracking
create table bodyweight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5,2) not null,
  created_at timestamptz not null default now()
);

-- Indexes on user_id (every RLS lookup) + common query columns
create index idx_exercise_user on exercise (user_id);
create index idx_exercise_primary_muscle on exercise (primary_muscle);
create index idx_template_user_pos on workout_template (user_id, position);
create index idx_template_exercise_user on template_exercise (user_id);
create index idx_template_exercise_template on template_exercise (template_id, position);
create index idx_session_user on session (user_id);
create index idx_session_user_date on session (user_id, date desc);
create index idx_session_exercise_user on session_exercise (user_id);
create index idx_session_exercise_session on session_exercise (session_id, position);
create index idx_session_exercise_exercise on session_exercise (exercise_id);
create index idx_set_user on "set" (user_id);
create index idx_set_session_exercise on "set" (session_exercise_id, set_number);
create index idx_bodyweight_user_date on bodyweight_log (user_id, date desc);

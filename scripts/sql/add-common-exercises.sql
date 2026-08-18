-- Adds commonly-trained movements to the shared exercise library.
--
-- The library is the one table users read but never write (user_id IS NULL =
-- global, seeded), so these rows have to be inserted with elevated access:
-- run this from the Supabase SQL editor, or via the Supabase MCP.
--
-- Safe to run more than once. Each row is guarded on a case-insensitive name
-- match against the existing global library, so re-running inserts nothing and
-- an exercise a user already created for themselves is left alone.
--
-- Every name here has a matching how-to in src/lib/exercise-guides.ts, which is
-- what the Exercises page expands under the row. If you add more movements,
-- add the guide in the same commit or the row will show up without one.

insert into public.exercise
  (user_id, name, primary_muscle, secondary_muscles, mechanic, equipment, default_rep_range)
select *
from (
  values
    -- Chest
    (null::uuid, 'Cable Fly',                          'chest'::muscle_group,      array['front_delt']::muscle_group[],                      'isolation', 'cable',      '10-15'),
    (null::uuid, 'Dumbbell Fly',                       'chest'::muscle_group,      array['front_delt']::muscle_group[],                      'isolation', 'dumbbell',   '10-15'),
    (null::uuid, 'Push-Up',                            'chest'::muscle_group,      array['triceps','front_delt']::muscle_group[],            'compound',  'bodyweight', '10-20'),
    (null::uuid, 'Chest Dip',                          'chest'::muscle_group,      array['triceps','front_delt']::muscle_group[],            'compound',  'bodyweight', '6-12'),
    (null::uuid, 'Decline Barbell Press',              'chest'::muscle_group,      array['triceps','front_delt']::muscle_group[],            'compound',  'barbell',    '6-10'),
    (null::uuid, 'Smith Machine Bench Press',          'chest'::muscle_group,      array['triceps','front_delt']::muscle_group[],            'compound',  'machine',    '6-10'),

    -- Back
    (null::uuid, 'Pull-Up',                            'back'::muscle_group,       array['biceps','rear_delt']::muscle_group[],              'compound',  'bodyweight', '5-10'),
    (null::uuid, 'Chin-Up',                            'back'::muscle_group,       array['biceps']::muscle_group[],                          'compound',  'bodyweight', '5-10'),
    (null::uuid, 'T-Bar Row',                          'back'::muscle_group,       array['biceps','rear_delt','traps']::muscle_group[],      'compound',  'barbell',    '6-10'),
    (null::uuid, 'Single-Arm Dumbbell Row',            'back'::muscle_group,       array['biceps','rear_delt']::muscle_group[],              'compound',  'dumbbell',   '8-12'),
    (null::uuid, 'Inverted Row',                       'back'::muscle_group,       array['biceps','rear_delt']::muscle_group[],              'compound',  'bodyweight', '8-15'),
    (null::uuid, 'Straight-Arm Pulldown',              'back'::muscle_group,       array['triceps']::muscle_group[],                         'isolation', 'cable',      '10-15'),
    (null::uuid, 'Rack Pull',                          'back'::muscle_group,       array['hamstrings','glutes','traps']::muscle_group[],     'compound',  'barbell',    '3-6'),

    -- Shoulders
    (null::uuid, 'Machine Shoulder Press',             'front_delt'::muscle_group, array['triceps','side_delt']::muscle_group[],             'compound',  'machine',    '8-12'),
    (null::uuid, 'Arnold Press',                       'front_delt'::muscle_group, array['side_delt','triceps']::muscle_group[],             'compound',  'dumbbell',   '8-12'),
    (null::uuid, 'Upright Row',                        'side_delt'::muscle_group,  array['traps','biceps']::muscle_group[],                  'compound',  'barbell',    '8-12'),
    (null::uuid, 'Reverse Pec Deck',                   'rear_delt'::muscle_group,  array['traps']::muscle_group[],                           'isolation', 'machine',    '12-15'),

    -- Traps
    (null::uuid, 'Barbell Shrug',                      'traps'::muscle_group,      array['forearms']::muscle_group[],                        'isolation', 'barbell',    '10-15'),
    (null::uuid, 'Dumbbell Shrug',                     'traps'::muscle_group,      array['forearms']::muscle_group[],                        'isolation', 'dumbbell',   '10-15'),

    -- Biceps
    (null::uuid, 'EZ-Bar Curl',                        'biceps'::muscle_group,     array['forearms']::muscle_group[],                        'isolation', 'barbell',    '8-12'),
    (null::uuid, 'Cable Curl',                         'biceps'::muscle_group,     array['forearms']::muscle_group[],                        'isolation', 'cable',      '10-15'),
    (null::uuid, 'Concentration Curl',                 'biceps'::muscle_group,     array[]::muscle_group[],                                  'isolation', 'dumbbell',   '10-15'),

    -- Triceps
    (null::uuid, 'Overhead Dumbbell Extension',        'triceps'::muscle_group,    array[]::muscle_group[],                                  'isolation', 'dumbbell',   '10-12'),
    (null::uuid, 'Bench Dip',                          'triceps'::muscle_group,    array['chest','front_delt']::muscle_group[],              'compound',  'bodyweight', '10-15'),

    -- Legs
    (null::uuid, 'Front Squat',                        'quads'::muscle_group,      array['glutes','abs']::muscle_group[],                    'compound',  'barbell',    '3-6'),
    (null::uuid, 'Smith Machine Squat',                'quads'::muscle_group,      array['glutes']::muscle_group[],                          'compound',  'machine',    '6-10'),
    (null::uuid, 'Walking Lunge',                      'quads'::muscle_group,      array['glutes','hamstrings']::muscle_group[],             'compound',  'dumbbell',   '10-12'),
    (null::uuid, 'Good Morning',                       'hamstrings'::muscle_group, array['glutes','back']::muscle_group[],                   'compound',  'barbell',    '6-10'),
    (null::uuid, 'Trap Bar Deadlift',                  'glutes'::muscle_group,     array['quads','hamstrings','back','traps']::muscle_group[],'compound', 'barbell',    '3-6'),
    (null::uuid, 'Leg Press Calf Raise',               'calves'::muscle_group,     array[]::muscle_group[],                                  'isolation', 'machine',    '10-15'),

    -- Core
    (null::uuid, 'Hanging Knee Raise',                 'abs'::muscle_group,        array['forearms']::muscle_group[],                        'isolation', 'bodyweight', '10-15'),
    (null::uuid, 'Decline Sit-Up',                     'abs'::muscle_group,        array[]::muscle_group[],                                  'isolation', 'bodyweight', '10-15'),
    (null::uuid, 'Ab Wheel Rollout',                   'abs'::muscle_group,        array['back']::muscle_group[],                            'compound',  'other',      '8-12'),

    -- Forearms
    (null::uuid, 'Reverse Curl',                       'forearms'::muscle_group,   array['biceps']::muscle_group[],                          'isolation', 'barbell',    '10-15'),
    (null::uuid, 'Wrist Curl',                         'forearms'::muscle_group,   array[]::muscle_group[],                                  'isolation', 'dumbbell',   '12-20')
) as v (user_id, name, primary_muscle, secondary_muscles, mechanic, equipment, default_rep_range)
where not exists (
  select 1
  from public.exercise x
  where x.user_id is null
    and lower(x.name) = lower(v.name)
);

-- What landed, so you can eyeball the result:
--   select name, primary_muscle, equipment from public.exercise
--   where user_id is null order by primary_muscle, name;

-- Removes two rows that add-common-exercises.sql inserted as duplicates.
--
-- That script guards each insert on an exact (case-insensitive) name match, so
-- it skips a movement the library already has under the *same* name, but it
-- can't see one filed under a different name. Two slipped through:
--
--   'Standing Barbell Shrug'              duplicates  'Barbell Shrug'
--   'Dumbbell Overhead Triceps Extension' duplicates  'Overhead Dumbbell Extension'
--
-- The library's own names win, and add-common-exercises.sql has been corrected
-- to use them, so running it again will not bring these back.
--
-- Only global rows are touched (user_id is null: nobody's custom exercise), and
-- only if nothing references them, so a row you have already logged a set
-- against or put in a template is left alone rather than cascading away.

delete from public.exercise e
where e.user_id is null
  and lower(e.name) in (
    'standing barbell shrug',
    'dumbbell overhead triceps extension'
  )
  and not exists (
    select 1 from public.session_exercise se where se.exercise_id = e.id
  )
  and not exists (
    select 1 from public.template_exercise te where te.exercise_id = e.id
  );

-- Anything left behind is referenced by real training data. Check with:
--   select name from public.exercise
--   where user_id is null
--     and lower(name) in ('standing barbell shrug','dumbbell overhead triceps extension');
-- If a row shows up there, rename it instead of deleting:
--   update public.exercise set name = 'Barbell Shrug (standing)' where ...;

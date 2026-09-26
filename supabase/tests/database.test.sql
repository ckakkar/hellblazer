-- The database's own guarantees, checked against a schema built from the
-- migrations alone (`supabase test db`, run by CI): two lifters can't see or
-- touch each other's data, server-only columns and functions stay server-only,
-- and the transactional functions do what the app relies on. Everything runs
-- in one transaction that's rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select cmp_ok(
  (select count(*) from public.exercise where user_id is null)::int, '>=', 140,
  'the built-in exercise library is seeded'
);

-- Lifter A ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select ok(
  public.load_preset('Test split', 4, current_date, '[
    {"name": "Upper", "dayLabel": "Day 1: Upper", "exercises": [
      {"name": "Barbell Bench Press", "sets": 3, "reps": "5"},
      {"name": "pendlay row", "sets": 3, "reps": "5"},
      {"name": "Not A Real Lift", "sets": 1, "reps": "1"}
    ]},
    {"name": "Lower", "dayLabel": "Day 2: Lower", "exercises": [
      {"name": "Barbell Back Squat", "sets": 3, "reps": "5"}
    ]}
  ]') is not null,
  'load_preset builds a program'
);
select is((select count(*) from public.program where is_active)::int, 1, 'with exactly one active program');
select is(
  (select count(*) from public.template_exercise)::int, 3,
  'preset lifts resolve by name, case-insensitively; unknown names are skipped'
);

select set_config('test.day', (select id::text from public.program_day order by position limit 1), true);
select set_config(
  'test.session',
  public.start_session(null, current_setting('test.day')::uuid, current_date, null)::text,
  true
);
select is(
  (select count(*) from public.session_exercise where session_id = current_setting('test.session')::uuid)::int, 2,
  'start_session copies the day''s exercises'
);
select is(
  (select title from public.session where id = current_setting('test.session')::uuid), 'Day 1: Upper',
  'and titles the session after the day'
);
select ok(
  (select program_id is not null from public.session where id = current_setting('test.session')::uuid),
  'a start from a program day counts toward the program'
);

insert into public."set" (user_id, session_exercise_id, set_number, weight_kg, reps)
select '00000000-0000-0000-0000-00000000000a', id, 1, 100, 5
from public.session_exercise
where session_id = current_setting('test.session')::uuid
order by position
limit 1;

insert into public.profile (user_id, display_name) values ('00000000-0000-0000-0000-00000000000a', 'A');
select set_config(
  'test.se',
  (select id::text from public.session_exercise where session_id = current_setting('test.session')::uuid order by position limit 1),
  true
);
insert into public.exercise (user_id, name, primary_muscle)
values ('00000000-0000-0000-0000-00000000000a', 'A''s own lift', 'chest');
select set_config(
  'test.custom',
  (select id::text from public.exercise where user_id = '00000000-0000-0000-0000-00000000000a'),
  true
);
select throws_ok(
  $$update public.profile set tier = 'king'$$, '42501', null,
  'rank columns are written by the server only'
);
select throws_ok(
  $$select * from public.watch_last_performances('00000000-0000-0000-0000-00000000000a', '{}')$$, '42501', null,
  'the watch API''s service-role function is off limits to lifters'
);

-- Lifter B ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.session)::int, 0, 'B sees none of A''s sessions');
select is((select count(*) from public."set")::int, 0, 'B sees none of A''s sets');
select is(
  (select count(*) from public.exercise_stats(null, '00000000-0000-0000-0000-00000000000a'))::int, 0,
  'B can''t read A''s lift stats by passing A''s id'
);
select is(
  (select count(*) from public.lift_trends('00000000-0000-0000-0000-00000000000a'))::int, 0,
  'nor A''s lift trends'
);
-- Even knowing A's ids, B can't hang rows off A's data: parents and
-- children must share an owner (composite foreign keys, exercise trigger).
select throws_ok(
  format(
    $$insert into public.session_exercise (user_id, session_id, exercise_id)
      values ('00000000-0000-0000-0000-00000000000b', %L, (select id from public.exercise where user_id is null limit 1))$$,
    current_setting('test.session')
  ),
  '23503', null,
  'B can''t add an exercise to A''s session'
);
select throws_ok(
  format(
    $$insert into public."set" (user_id, session_exercise_id, set_number, weight_kg, reps)
      values ('00000000-0000-0000-0000-00000000000b', %L, 1, 100, 5)$$,
    current_setting('test.se')
  ),
  '23503', null,
  'B can''t log a set under A''s exercise'
);
insert into public.workout_template (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'B day');
select throws_ok(
  format(
    $$insert into public.template_exercise (user_id, template_id, exercise_id)
      select '00000000-0000-0000-0000-00000000000b', id, %L from public.workout_template
      where user_id = '00000000-0000-0000-0000-00000000000b'$$,
    current_setting('test.custom')
  ),
  '23503', null,
  'B can''t use A''s custom exercise'
);
-- Tried here, checked below once A's row is visible again.
update public.session set title = 'mine now';
select throws_ok(
  format('select public.start_session(null, %L, null, null)', current_setting('test.day')), 'P0001', 'program day not found',
  'B can''t start a session from A''s program day'
);
select throws_ok(
  $$select public.start_session(null, null, null, '00000000-0000-0000-0000-00000000000a')$$, 'P0001', 'not allowed',
  'B can''t start a session as A'
);

-- Signed out ----------------------------------------------------------------
set local role anon;
select throws_ok($$select public.start_session()$$, '42501', null, 'anonymous callers can''t start sessions');

reset role;
select is(
  (select title from public.session where id = current_setting('test.session')::uuid), 'Day 1: Upper',
  'B''s update didn''t touch A''s session'
);

select * from finish();
rollback;

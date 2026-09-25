insert into exercise (user_id, name, primary_muscle, secondary_muscles, mechanic, equipment, default_rep_range)
select null, v.name, v.primary_muscle::muscle_group, v.secondary_muscles::muscle_group[], v.mechanic, v.equipment, v.rep
from (values
  ('Goblet Squat','quads','{glutes,hamstrings}','compound','dumbbell','10-15'),
  ('Dumbbell Forward Lunge','quads','{glutes,hamstrings}','compound','dumbbell','8-12'),
  ('Dumbbell Step-Up','quads','{glutes,hamstrings}','compound','dumbbell','8-12'),
  ('Sumo Squat','quads','{glutes,hamstrings}','compound','dumbbell','10-15'),
  ('Dumbbell Curl','biceps','{forearms}','isolation','dumbbell','8-12'),
  ('Dumbbell Front Raise','front_delt','{}','isolation','dumbbell','10-15'),
  ('Dumbbell Romanian Deadlift','hamstrings','{glutes,back}','compound','dumbbell','8-12'),
  ('Single-Leg Romanian Deadlift','hamstrings','{glutes}','compound','dumbbell','8-12'),
  ('Glute Bridge','glutes','{hamstrings}','compound','dumbbell','12-20'),
  ('Curtsy Lunge','glutes','{quads,hamstrings}','compound','dumbbell','10-12'),
  ('Donkey Kick','glutes','{hamstrings}','isolation','dumbbell','12-20'),
  ('Dumbbell Bent-Over Row','back','{rear_delt,biceps}','compound','dumbbell','8-12'),
  ('Renegade Row','back','{abs,rear_delt}','compound','dumbbell','8-12'),
  ('Dumbbell Pullover','back','{chest,triceps}','isolation','dumbbell','10-15'),
  ('Weighted Crunch','abs','{}','isolation','dumbbell','12-20'),
  ('Russian Twist','abs','{}','isolation','dumbbell','12-20'),
  ('Sumo Deadlift','glutes','{hamstrings,quads,back}','compound','dumbbell','8-12'),
  ('Fire Hydrant','glutes','{}','isolation','dumbbell','12-20'),
  ('Lateral Lunge','quads','{glutes,hamstrings}','compound','dumbbell','10-15')
) as v(name, primary_muscle, secondary_muscles, mechanic, equipment, rep)
where not exists (
  select 1 from exercise e where e.user_id is null and lower(e.name) = lower(v.name)
);

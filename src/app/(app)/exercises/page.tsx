import { getExercises } from "@/lib/data/exercises";
import { ExercisesBrowser } from "./exercises-browser";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await getExercises();
  return <ExercisesBrowser exercises={exercises} />;
}

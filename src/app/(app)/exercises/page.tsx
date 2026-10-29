import type { Metadata } from "next";
import { getExercises } from "@/lib/data/exercises";
import { ExercisesBrowser } from "./exercises-browser";

export const metadata: Metadata = { title: "Exercises" };

export const dynamic = "force-dynamic";

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [exercises, { new: name }] = await Promise.all([getExercises(), searchParams]);
  // ?new=<name>: a picker's search found nothing, and the lifter wants it made.
  return <ExercisesBrowser exercises={exercises} createName={name?.slice(0, 120) ?? null} />;
}

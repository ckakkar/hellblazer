import type { Metadata } from "next";
import { getExercises } from "@/lib/data/exercises";
import { getLiftNotes } from "@/lib/data/lift-notes";
import { requireSessionUser } from "@/lib/auth";
import { ExercisesBrowser } from "./exercises-browser";

export const metadata: Metadata = { title: "Exercises" };

export const dynamic = "force-dynamic";

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [exercises, liftNotes, user, { new: name }] = await Promise.all([getExercises(), getLiftNotes(), requireSessionUser(), searchParams]);
  // ?new=<name>: a picker's search found nothing, and the lifter wants it made.
  return <ExercisesBrowser exercises={exercises} liftNotes={liftNotes} userId={user.id} createName={name?.slice(0, 120) ?? null} />;
}

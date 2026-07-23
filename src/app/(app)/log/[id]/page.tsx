import { notFound } from "next/navigation";
import {
  getSessionDetail,
  getLastPerformances,
  getExercisePRs,
} from "@/lib/data/sessions";
import { getExercises } from "@/lib/data/exercises";
import { getUnit } from "@/lib/settings";
import { SessionLogger } from "./session-logger";

export const dynamic = "force-dynamic";

export default async function LoggerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, exerciseLibrary, unit, exercisePRs] = await Promise.all([
    getSessionDetail(id),
    getExercises(),
    getUnit(),
    getExercisePRs(id),
  ]);
  if (!session) notFound();

  const exerciseIds = [
    ...new Set(session.session_exercise.map((se) => se.exercise_id)),
  ];
  const lastPerformances = await getLastPerformances(exerciseIds, id);

  return (
    <SessionLogger
      session={session}
      exerciseLibrary={exerciseLibrary}
      lastPerformances={lastPerformances}
      exercisePRs={exercisePRs}
      unit={unit}
    />
  );
}

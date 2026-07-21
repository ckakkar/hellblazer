import { notFound } from "next/navigation";
import { getSessionDetail, getLastPerformances } from "@/lib/data/sessions";
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
  const [session, exerciseLibrary, unit] = await Promise.all([
    getSessionDetail(id),
    getExercises(),
    getUnit(),
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
      unit={unit}
    />
  );
}

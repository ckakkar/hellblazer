import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getSessionDetail,
  getLastPerformances,
  getExercisePRs,
  getSessionTargets,
} from "@/lib/data/sessions";
import { getExercises } from "@/lib/data/exercises";
import { getUnit } from "@/lib/settings";
import { getProfile } from "@/lib/data/profile";
import { getTier } from "@/lib/tiers";
import { SessionLogger } from "./session-logger";

export const metadata: Metadata = { title: "Workout" };

export const dynamic = "force-dynamic";

export default async function LoggerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, exerciseLibrary, unit, exercisePRs, profile] = await Promise.all([
    getSessionDetail(id),
    getExercises(),
    getUnit(),
    getExercisePRs(id),
    getProfile(),
  ]);
  if (!session) notFound();

  const exerciseIds = [
    ...new Set(session.session_exercise.map((se) => se.exercise_id)),
  ];
  const [lastPerformances, targets] = await Promise.all([
    getLastPerformances(exerciseIds, id),
    getSessionTargets(session),
  ]);

  return (
    <SessionLogger
      session={session}
      exerciseLibrary={exerciseLibrary}
      lastPerformances={lastPerformances}
      targets={targets}
      exercisePRs={exercisePRs}
      unit={unit}
      fighter={getTier(profile?.tier)?.key ?? "ohma"}
    />
  );
}

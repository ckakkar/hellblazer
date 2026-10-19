import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
import { LiveView } from "./live-view";
import { isIPadApp } from "@/lib/surface";
import { boardIsOver, liveBoard } from "@/lib/live-board";

export const metadata: Metadata = { title: "Workout" };

export const dynamic = "force-dynamic";

export default async function LoggerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const [session, exerciseLibrary, unit, exercisePRs, profile, ipad] = await Promise.all([
    getSessionDetail(id),
    getExercises(),
    getUnit(),
    getExercisePRs(id),
    getProfile(),
    isIPadApp(),
  ]);
  // Discarded on the phone while the iPad watched.
  if (!session && ipad) redirect("/dashboard");
  if (!session) notFound();

  // The iPad watches a workout; it doesn't log one. A finished workout is
  // edited from its session page (`?edit`), as on the phone.
  const fighter = getTier(profile?.tier)?.key ?? "ohma";
  if (ipad && edit === undefined) {
    if (boardIsOver(session.finished_at)) redirect(`/history/${id}`);
    const exerciseIds = [...new Set(session.session_exercise.map((se) => se.exercise_id))];
    const [last, targets] = await Promise.all([
      getLastPerformances(exerciseIds, id),
      getSessionTargets(session),
    ]);
    return (
      <LiveView
        sessionId={session.id}
        userId={session.user_id}
        title={session.title ?? "Workout"}
        startedAt={session.created_at}
        finishedAt={session.finished_at}
        durationMin={session.duration_min}
        board={liveBoard(session, targets, exercisePRs)}
        last={last}
        unit={unit}
        fighter={fighter}
      />
    );
  }

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
      fighter={fighter}
    />
  );
}

import type { Metadata } from "next";
import {
  getDeletedWorkouts,
  getSessionIdsWithExercise,
  getSessionSummaries,
} from "@/lib/data/sessions";
import { getTemplates } from "@/lib/data/templates";
import { getExerciseStats } from "@/lib/data/exercise-stats";
import { getUnit } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { HistoryList } from "./history-list";
import { RecentlyDeleted } from "./recently-deleted";

export const metadata: Metadata = { title: "History" };

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { exercise } = await searchParams;
  const liftId = exercise && /^[0-9a-f-]{36}$/i.test(exercise) ? exercise : null;
  const [sessions, templates, unit, lifts, withLift, deleted] = await Promise.all([
    getSessionSummaries(),
    getTemplates(),
    getUnit(),
    getExerciseStats(),
    liftId ? getSessionIdsWithExercise(liftId) : Promise.resolve(null),
    getDeletedWorkouts(),
  ]);

  return (
    <div>
      <PageHeader
        title="History"
        stat={{
          value: sessions.length,
          label: sessions.length === 1 ? "session" : "sessions",
        }}
      />
      <HistoryList
        sessions={sessions}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        lifts={lifts
          .map((l) => ({ id: l.exercise_id, name: l.exercise_name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        liftId={liftId}
        withLift={withLift}
        unit={unit}
      />
      <RecentlyDeleted workouts={deleted} />
    </div>
  );
}

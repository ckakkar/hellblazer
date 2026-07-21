import { TrendingUp } from "lucide-react";
import { getLoggedExercises } from "@/lib/data/exercises";
import {
  getExerciseProgression,
  getMuscleWeeklySeries,
} from "@/lib/data/analytics";
import { getUnit } from "@/lib/settings";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { ChartCard } from "@/components/ui/chart-card";
import { StatCard } from "@/components/ui/stat-card";
import {
  OneRepMaxChart,
  VolumeBarsChart,
} from "@/components/charts/exercise-charts";
import { MuscleTrendChart } from "@/components/charts/muscle-trend-chart";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL, isWeakPoint, type Muscle } from "@/lib/muscles";
import { ProgressControls } from "./progress-controls";

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; exercise?: string; muscle?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "muscle" ? "muscle" : "exercise";
  const [loggedExercises, unit] = await Promise.all([
    getLoggedExercises(),
    getUnit(),
  ]);

  const selectedMuscle = (sp.muscle as Muscle) || "back";
  const selectedExercise =
    sp.exercise || loggedExercises[0]?.exercise_id || undefined;

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Estimated 1RM, volume and per-muscle trends over time."
      />
      <ProgressControls
        tab={tab}
        exercises={loggedExercises}
        selectedExercise={selectedExercise}
        selectedMuscle={selectedMuscle}
      />

      {tab === "exercise" ? (
        loggedExercises.length === 0 || !selectedExercise ? (
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="No logged exercises yet"
            body="Log some working sets and your 1RM and volume trends will appear here."
          />
        ) : (
          <ExerciseTab exerciseId={selectedExercise} unit={unit} />
        )
      ) : (
        <MuscleTab muscle={selectedMuscle} unit={unit} />
      )}
    </div>
  );
}

async function ExerciseTab({
  exerciseId,
  unit,
}: {
  exerciseId: string;
  unit: "kg" | "lb";
}) {
  const { points, pr } = await getExerciseProgression(exerciseId);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Heaviest"
          value={trimNum(toDisplayWeight(pr.topWeight, unit))}
          unit={unit}
        />
        <StatCard
          label="Best est. 1RM"
          value={trimNum(toDisplayWeight(pr.bestEst1rm, unit))}
          unit={unit}
          highlight
        />
        <StatCard
          label="Best set volume"
          value={formatVolume(pr.bestSetVolume, unit)}
        />
        <StatCard label="Sessions" value={pr.sessionsLogged} />
      </div>

      <ChartCard
        title="Estimated 1RM"
        subtitle="Best working set per session · Epley"
      >
        <OneRepMaxChart data={points} unit={unit} />
      </ChartCard>

      <ChartCard title="Volume per session" subtitle="Working sets only">
        <VolumeBarsChart data={points} unit={unit} />
      </ChartCard>
    </div>
  );
}

async function MuscleTab({
  muscle,
  unit,
}: {
  muscle: Muscle;
  unit: "kg" | "lb";
}) {
  const points = await getMuscleWeeklySeries(muscle, 12);
  const lastWeek = points[points.length - 1];
  const avgSets =
    points.length > 0
      ? points.reduce((n, p) => n + p.sets, 0) / points.length
      : 0;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="This week"
          value={trimNum(Math.round((lastWeek?.sets ?? 0) * 10) / 10)}
          unit="sets"
          highlight={isWeakPoint(muscle)}
        />
        <StatCard
          label="12-wk avg"
          value={trimNum(Math.round(avgSets * 10) / 10)}
          unit="sets/wk"
        />
        <StatCard
          label="This week vol"
          value={formatVolume(lastWeek?.volume ?? 0, unit)}
        />
      </div>

      <ChartCard
        title={`${MUSCLE_LABEL[muscle]} — weekly sets & volume`}
        subtitle="Sets (bars) with volume overlay · secondary muscles weighted 0.5"
      >
        <MuscleTrendChart
          data={points}
          unit={unit}
          accent={isWeakPoint(muscle)}
        />
      </ChartCard>
    </div>
  );
}

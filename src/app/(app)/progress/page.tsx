import { TrendingUp } from "lucide-react";
import { getLoggedExercises } from "@/lib/data/exercises";
import {
  getAllExercise1RMs,
  getExerciseProgression,
  getMuscleBalance,
  getMuscleWeeklySeries,
} from "@/lib/data/analytics";
import { getUnit } from "@/lib/settings";
import { getProfile } from "@/lib/data/profile";
import { LadderStanding } from "@/components/tier/ladder-standing";
import { OneRepMaxBoard } from "@/components/one-rep-max-board";
import { PageHeader, EmptyState, SectionLabel } from "@/components/ui/page-header";
import { ChartCard } from "@/components/ui/chart-card";
import { StatCard } from "@/components/ui/stat-card";
import {
  OneRepMaxChart,
  VolumeBarsChart,
} from "@/components/charts/exercise-charts";
import { MuscleTrendChart } from "@/components/charts/muscle-trend-chart";
import { MuscleVolumeDonut } from "@/components/charts/muscle-volume-donut";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL, MUSCLES, isWeakPoint, type Muscle } from "@/lib/muscles";
import { ProgressControls } from "./progress-controls";

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; exercise?: string; muscle?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "muscle" ? "muscle" : "exercise";
  const [loggedExercises, unit, profile, oneRepMaxes] = await Promise.all([
    getLoggedExercises(),
    getUnit(),
    getProfile(),
    getAllExercise1RMs(),
  ]);

  // Validate URL params: bad values fall back instead of crashing the page.
  const selectedMuscle: Muscle = MUSCLES.includes(sp.muscle as Muscle)
    ? (sp.muscle as Muscle)
    : "back";
  const selectedExercise =
    (sp.exercise &&
    loggedExercises.some((e) => e.exercise_id === sp.exercise)
      ? sp.exercise
      : undefined) ??
    loggedExercises[0]?.exercise_id ??
    undefined;

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Estimated 1RM, volume and per-muscle trends over time."
      />

      <LadderStanding tierKey={profile?.tier ?? null} />

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

      {oneRepMaxes.length > 0 && (
        <div className="mt-8">
          <SectionLabel>Strength board · every lift</SectionLabel>
          <OneRepMaxBoard rows={oneRepMaxes} unit={unit} />
        </div>
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
  const [points, balance] = await Promise.all([
    getMuscleWeeklySeries(muscle, 12),
    getMuscleBalance(4),
  ]);
  const lastWeek = points[points.length - 1];
  const avgSets =
    points.length > 0
      ? points.reduce((n, p) => n + p.sets, 0) / points.length
      : 0;
  const hasMuscleData = points.some((p) => p.sets > 0);

  return (
    <div className="grid gap-4">
      {hasMuscleData ? (
        <>
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
            title={`${MUSCLE_LABEL[muscle]}: weekly sets & volume`}
            subtitle="Sets (bars) with volume overlay · secondary muscles weighted 0.5"
          >
            <MuscleTrendChart
              data={points}
              unit={unit}
              accent={isWeakPoint(muscle)}
            />
          </ChartCard>
        </>
      ) : (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title={`No ${MUSCLE_LABEL[muscle]} work logged yet`}
          body="Log sets that train this muscle and its weekly trend, volume and stats will show up here."
        />
      )}

      <ChartCard
        title="Volume distribution"
        subtitle="Where your tonnage went · last 4 weeks"
        bodyClassName="p-4"
      >
        <MuscleVolumeDonut data={balance} unit={unit} />
      </ChartCard>
    </div>
  );
}

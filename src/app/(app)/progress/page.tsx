import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getLoggedExercises } from "@/lib/data/exercises";
import {
  getAllExercise1RMs,
  getExerciseProgression,
  getMuscleBalance,
  getMuscleWeeklySeries,
  getRecentRecords,
  getRepRangeWeeks,
  getTopLiftTrends,
} from "@/lib/data/analytics";
import { LiftTrends } from "@/components/charts/lift-trends";
import { RecentRecords } from "@/components/charts/recent-records";
import { RepRangeChart } from "@/components/charts/rep-range-chart";
import { getUnit } from "@/lib/settings";
import { getProfile } from "@/lib/data/profile";
import { LadderStanding } from "@/components/tier/ladder-standing";
import { OneRepMaxBoard } from "@/components/one-rep-max-board";
import { PageHeader, EmptyState, SectionLabel } from "@/components/ui/page-header";
import { ChartCard } from "@/components/ui/chart-card";
import { buttonVariants } from "@/components/ui/button";
import { Tape, TapeRow } from "@/components/ui/tape";
import {
  OneRepMaxChart,
  VolumeBarsChart,
} from "@/components/charts/exercise-charts";
import { MuscleTrendChart } from "@/components/charts/muscle-trend-chart";
import { MuscleVolumeDonut } from "@/components/charts/muscle-volume-donut";
import { MuscleBalanceRadar } from "@/components/charts/muscle-balance-radar";
import { formatVolume, toDisplayWeight, trimNum } from "@/lib/units";
import { MUSCLE_LABEL, MUSCLES, isWeakPoint, type Muscle } from "@/lib/muscles";
import { ProgressControls } from "./progress-controls";

export const metadata: Metadata = { title: "Progress" };

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
        subtitle="Strength and volume over time, lift by lift and muscle by muscle."
        stat={{ value: oneRepMaxes.length, label: "tracked lifts" }}
      />

      <ProgressControls
        tab={tab}
        exercises={loggedExercises}
        selectedExercise={selectedExercise}
        selectedMuscle={selectedMuscle}
      />

      {tab === "exercise" && loggedExercises.length > 0 && selectedExercise && (
        <div className="mb-10">
          <LiftTrendsSection unit={unit} />
        </div>
      )}

      {/* On a desktop the page splits: the open lift (or muscle) on the left,
          the latest records and the ladder beside it, and every lift below in
          two columns. On a phone the right column dissolves back into the
          single stack, in the order it always had. */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-start lg:gap-x-8 lg:gap-y-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <div className="min-w-0">
          {tab === "exercise" ? (
            loggedExercises.length === 0 || !selectedExercise ? (
              <EmptyState
                icon={<TrendingUp className="size-6" />}
                title="No logged exercises yet"
                body="Log some working sets and your 1RM and volume trends will appear here."
                action={
                  <Link href="/log" className={buttonVariants({ variant: "secondary" })}>
                    Start a workout
                  </Link>
                }
              />
            ) : (
              <ExerciseTab
                exerciseId={selectedExercise}
                exerciseName={
                  loggedExercises.find((e) => e.exercise_id === selectedExercise)
                    ?.exercise_name ?? "This lift"
                }
                unit={unit}
              />
            )
          ) : (
            <MuscleTab muscle={selectedMuscle} unit={unit} />
          )}
        </div>

        <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-10">
          {tab === "exercise" && loggedExercises.length > 0 && selectedExercise && (
            <div className="-order-1 min-w-0 lg:order-none">
              <RecentRecordsSection unit={unit} />
            </div>
          )}
          <div className="order-1 min-w-0 lg:order-none">
            <LadderStanding tierKey={profile?.tier ?? null} />
          </div>
        </aside>

        {oneRepMaxes.length > 0 && (
          <div className="min-w-0 lg:col-span-2">
            <SectionLabel action={<span className="text-[13px] text-muted">Best estimated 1RM</span>}>
              All lifts
            </SectionLabel>
            <OneRepMaxBoard
              rows={oneRepMaxes}
              unit={unit}
              selected={tab === "exercise" ? selectedExercise : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** The top lifts' 12-week lines. */
async function LiftTrendsSection({ unit }: { unit: "kg" | "lb" }) {
  const lifts = await getTopLiftTrends(4, 12);
  if (lifts.length === 0) return null;
  return <LiftTrends lifts={lifts} unit={unit} />;
}

/** The latest records broken. */
async function RecentRecordsSection({ unit }: { unit: "kg" | "lb" }) {
  const records = await getRecentRecords(5);
  if (records.length === 0) return null;
  return <RecentRecords records={records} unit={unit} />;
}

async function ExerciseTab({
  exerciseId,
  exerciseName,
  unit,
}: {
  exerciseId: string;
  exerciseName: string;
  unit: "kg" | "lb";
}) {
  const { points, pr } = await getExerciseProgression(exerciseId);

  return (
    // The top-lift cards link here (#lift); the margin clears the top bar.
    <div id="lift" className="grid scroll-mt-24 grid-cols-1 gap-4">
      {/* A lift's personal records are a tale of the tape by any other name, so
          they're set as one: the lift is named, and the records read down a
          column instead of sitting in four equal boxes. */}
      <Tape title={`${exerciseName} records`}>
        <TapeRow
          label="Best 1RM"
          value={trimNum(toDisplayWeight(pr.bestEst1rm, unit))}
          unit={unit}
          note="estimated, Epley"
        />
        <TapeRow
          label="Heaviest"
          value={trimNum(toDisplayWeight(pr.topWeight, unit))}
          unit={unit}
          note="single working set"
        />
        <TapeRow
          label="Best set"
          value={formatVolume(pr.bestSetVolume, unit).split(" ")[0]}
          unit={formatVolume(pr.bestSetVolume, unit).split(" ")[1]}
          note="weight × reps"
        />
        <TapeRow
          label="Sessions"
          value={pr.sessionsLogged}
          note="with this lift logged"
        />
      </Tape>

      <ChartCard
        title="Estimated 1RM"
        subtitle="Best working set per session (Epley)"
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
  const [points, balance, repRanges] = await Promise.all([
    getMuscleWeeklySeries(muscle, 12),
    getMuscleBalance(4),
    getRepRangeWeeks(8),
  ]);
  const lastWeek = points[points.length - 1];
  const avgSets =
    points.length > 0
      ? points.reduce((n, p) => n + p.sets, 0) / points.length
      : 0;
  const hasMuscleData = points.some((p) => p.sets > 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard
        title="Rep ranges"
        subtitle="Working sets per week: strength 1-5, hypertrophy 6-12, endurance 13+"
      >
        <RepRangeChart weeks={repRanges} />
      </ChartCard>

      {hasMuscleData ? (
        <>
          <Tape title={`${MUSCLE_LABEL[muscle]} this week`}>
            <TapeRow
              label="Sets"
              value={trimNum(Math.round((lastWeek?.sets ?? 0) * 10) / 10)}
              note="working sets this week"
            />
            <TapeRow
              label="12-wk avg"
              value={trimNum(Math.round(avgSets * 10) / 10)}
              unit="sets/wk"
              note="your running rate"
            />
            <TapeRow
              label="Tonnage"
              value={formatVolume(lastWeek?.volume ?? 0, unit).split(" ")[0]}
              unit={formatVolume(lastWeek?.volume ?? 0, unit).split(" ")[1]}
              note="this week"
            />
          </Tape>

          <ChartCard
            title="Weekly sets and volume"
            subtitle="Bars are sets, the line is volume. Secondary muscles count half."
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

      <ChartCard title="Balance" subtitle="Average weekly sets per muscle, last 4 weeks">
        <MuscleBalanceRadar data={balance} />
      </ChartCard>

      <ChartCard title="Where the volume went" subtitle="Last 4 weeks" bodyClassName="p-4">
        <MuscleVolumeDonut data={balance} unit={unit} />
      </ChartCard>
    </div>
  );
}

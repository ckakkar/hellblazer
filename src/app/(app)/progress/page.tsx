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
import { format, parseISO } from "date-fns";
import { formatVolume, toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import { liftStory } from "@/lib/lift-story";
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
  const [loggedExercises, unit, profile, oneRepMaxes, trends] = await Promise.all([
    getLoggedExercises(),
    getUnit(),
    getProfile(),
    getAllExercise1RMs(),
    getTopLiftTrends(4, 12),
  ]);

  // Validate URL params: bad values fall back instead of crashing the page.
  const selectedMuscle: Muscle = MUSCLES.includes(sp.muscle as Muscle)
    ? (sp.muscle as Muscle)
    : "back";
  // With no lift asked for, the page opens on the one that moved most: the
  // biggest gain among your top lifts, else your most-logged lift.
  const mover = trends
    .filter((t) => (t.changePct ?? 0) > 0 && loggedExercises.some((e) => e.exercise_id === t.exerciseId))
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  const selectedExercise =
    (sp.exercise &&
    loggedExercises.some((e) => e.exercise_id === sp.exercise)
      ? sp.exercise
      : undefined) ??
    mover?.exerciseId ??
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
            <>
              {/* The other lifts, quieter: a line each to compare against. */}
              {trends.length > 1 && (
                <div className="min-w-0">
                  <LiftTrends lifts={trends} unit={unit} selected={selectedExercise} />
                </div>
              )}
              <div className="min-w-0">
                <RecentRecordsSection unit={unit} />
              </div>
            </>
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
    // The top-lift list links here (#lift); the margin clears the top bar.
    <div id="lift" className="grid scroll-mt-24 grid-cols-1 gap-8">
      <section>
        <LiftLead name={exerciseName} points={points} unit={unit} />
        <div className="mt-6">
          <OneRepMaxChart data={points} unit={unit} height={300} />
        </div>
        {/* From the line to the workouts behind it. */}
        <Link
          href={`/history?exercise=${exerciseId}`}
          className="mt-3 inline-block text-[13px] text-muted underline decoration-text/25 underline-offset-4 hover:text-text"
        >
          Every session with {exerciseName}
        </Link>
      </section>

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

      <ChartCard title="Volume per session" subtitle="Working sets only">
        <VolumeBarsChart data={points} unit={unit} />
      </ChartCard>
    </div>
  );
}

/**
 * The lift's story in one figure: how far its estimated max moved over the
 * block, with where it started and where its record sits. The dot by the
 * record matches the one on the chart below.
 */
function LiftLead({
  name,
  points,
  unit,
}: {
  name: string;
  points: { date: string; est1rm: number }[];
  unit: Unit;
}) {
  const story = liftStory(points);
  const w = (kg: number) => trimNum(Math.round(toDisplayWeight(kg, unit) * 2) / 2);
  if (!story) {
    return <h2 className="text-[1.375rem] font-bold tracking-[-0.025em] text-text">{name}</h2>;
  }
  const moved = story.sessions > 1 ? Math.round(toDisplayWeight(story.change, unit) * 2) / 2 : 0;
  const span = `${story.weeks} ${story.weeks === 1 ? "week" : "weeks"}`;
  const figure = moved > 0 ? `+${trimNum(moved)}` : moved < 0 ? `−${trimNum(-moved)}` : w(story.to);
  const line =
    story.sessions === 1
      ? "Estimated max, from the one session in the last 12 weeks."
      : moved === 0
        ? `Estimated max, level over ${span}.`
        : `On its estimated max over ${span}, ${w(story.from)} to ${w(story.to)} ${unit}.`;
  const recordIsLatest = story.record.value <= story.to;
  return (
    <header>
      <h2 className="text-[1.375rem] font-bold leading-tight tracking-[-0.025em] text-text">{name}</h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[clamp(3.25rem,15vw,5rem)] leading-[0.9] text-text">{figure}</span>
        <span className="text-[17px] text-muted">{unit}</span>
      </p>
      <p className="mt-3 max-w-md text-[15px] leading-6 text-text/80">
        {line}{" "}
        <span className="whitespace-nowrap text-muted">
          <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />
          {recordIsLatest && story.sessions > 1
            ? `A record, ${format(parseISO(story.record.date), "d MMM")}.`
            : `Record ${w(story.record.value)} ${unit}, ${format(parseISO(story.record.date), "d MMM")}.`}
        </span>
      </p>
    </header>
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

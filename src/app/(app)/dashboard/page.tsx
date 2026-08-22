import Link from "next/link";
import { format, parseISO, startOfISOWeek, subWeeks } from "date-fns";
import {
  getCurrentWeekSetsPerMuscle,
  getMuscleBalance,
} from "@/lib/data/analytics";
import { getSessionSummaries } from "@/lib/data/sessions";
import { getActiveProgramProgress, getPrograms } from "@/lib/data/programs";
import { getProfile } from "@/lib/data/profile";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { OnboardingHero } from "./onboarding-hero";
import { PRESETS } from "@/lib/presets";
import { FightCardHero } from "@/components/tier/fight-card-hero";
import { getTier } from "@/lib/tiers";
import { getUnit } from "@/lib/settings";
import { SectionLabel } from "@/components/ui/page-header";
import { Tape, TapeRow, Delta, BarRow, type DeltaTone } from "@/components/ui/tape";
import { ChartCard } from "@/components/ui/chart-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WeeklySetsChart } from "@/components/charts/weekly-sets-chart";
import { VolumeTrendCard } from "@/components/charts/volume-trend-card";
import { ConsistencyHeatmap } from "@/components/charts/consistency-heatmap";
import { MuscleBalanceRadar } from "@/components/charts/muscle-balance-radar";
import { formatVolume } from "@/lib/units";
import { MUSCLE_LABEL, WEAK_POINTS } from "@/lib/muscles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    weeklySets,
    muscleBalance,
    summaries,
    activeProgress,
    programs,
    profile,
    unit,
  ] = await Promise.all([
    getCurrentWeekSetsPerMuscle(),
    getMuscleBalance(4),
    getSessionSummaries(),
    getActiveProgramProgress(),
    getPrograms(),
    getProfile(),
    getUnit(),
  ]);
  const tier = getTier(profile?.tier);

  // A brand-new lifter (no history, no programs) gets pushed straight at a split.
  const isNewUser = summaries.length === 0 && programs.length === 0;
  const featuredPreset =
    PRESETS.find((p) => p.days.length === 5) ?? PRESETS[0];
  const presetLite = (p: (typeof PRESETS)[number]) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    days: p.days.length,
    weeks: p.weeks ?? 8,
  });

  const weekStart = startOfISOWeek(new Date());
  const prevWeekStart = subWeeks(weekStart, 1);

  // A tale of the tape is a comparison by definition, so every figure is
  // measured against the same window one week back. The old dashboard showed
  // three bare totals with nothing to read them against.
  const inWeek = (from: Date, to?: Date) =>
    summaries.filter((s) => {
      if (!s.session_date) return false;
      const d = parseISO(s.session_date);
      return d >= from && (!to || d < to);
    });
  const thisWeek = inWeek(weekStart);
  const lastWeek = inWeek(prevWeekStart, weekStart);

  const sum = (rows: typeof summaries, key: "total_volume" | "working_sets") =>
    rows.reduce((n, s) => n + Number(s[key] ?? 0), 0);

  const volumeThisWeek = sum(thisWeek, "total_volume");
  const volumeLastWeek = sum(lastWeek, "total_volume");
  const workingSetsThisWeek = sum(thisWeek, "working_sets");
  const workingSetsLastWeek = sum(lastWeek, "working_sets");

  /** Percent move on last week, or null when there's no baseline to compare. */
  const move = (now: number, before: number) =>
    before > 0 ? Math.round(((now - before) / before) * 100) : null;

  const toneOf = (pct: number | null): DeltaTone =>
    pct === null || pct === 0 ? "flat" : pct > 0 ? "gain" : "loss";

  const deltaLabel = (pct: number | null) =>
    pct === null ? "first week" : pct === 0 ? "level" : `${Math.abs(pct)}%`;

  const volumeMove = move(volumeThisWeek, volumeLastWeek);
  const setsMove = move(workingSetsThisWeek, workingSetsLastWeek);

  // Sessions read against the active program's weekly target, not last week —
  // "4 of 5 programmed" is the honest measure of a training week.
  const sessionTarget = activeProgress?.daysPerWeek ?? null;
  const sessionsTone: DeltaTone = sessionTarget
    ? thisWeek.length >= sessionTarget
      ? "gain"
      : "loss"
    : "flat";

  const setsByMuscle = new Map(weeklySets.map((m) => [m.muscle, m.sets]));
  const weakPointRows = WEAK_POINTS.map((m) => ({
    muscle: m,
    label: MUSCLE_LABEL[m],
    sets: Math.round((setsByMuscle.get(m) ?? 0) * 10) / 10,
  }));
  const weakPointMax = Math.max(1, ...weakPointRows.map((r) => r.sets));
  // Only the muscle actually trailing the group gets marked, so the accent
  // still means one thing.
  const weakPointMin = Math.min(...weakPointRows.map((r) => r.sets));

  const recent = summaries.slice(0, 6);

  // Daily lifted tonnage (canonical kg) for the volume-trend windows, the card
  // re-buckets this client-side per selected range (7d / 30d / 1y).
  const dailyVolumeMap = new Map<string, number>();
  for (const s of summaries) {
    if (!s.session_date) continue;
    dailyVolumeMap.set(
      s.session_date,
      (dailyVolumeMap.get(s.session_date) ?? 0) + Number(s.total_volume ?? 0),
    );
  }
  const dailyVolume = [...dailyVolumeMap.entries()].map(([date, volumeKg]) => ({
    date,
    volumeKg,
  }));

  return (
    <div>
      <FightCardHero tier={tier} className="mb-7" />

      {isNewUser ? (
        <OnboardingHero
          featured={presetLite(featuredPreset)}
          others={PRESETS.filter((p) => p.id !== featuredPreset.id).map(
            presetLite,
          )}
        />
      ) : activeProgress ? (
        <div className="mb-6">
          <ProgramProgressCard
            progress={activeProgress}
            href={`/programs/${activeProgress.program.id}`}
          />
        </div>
      ) : (
        <Card className="mb-6 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-base uppercase tracking-wide text-text">
              Nothing programmed
            </div>
            <p className="mt-0.5 text-sm text-muted">
              Pick a split and it schedules your week for you.
            </p>
          </div>
          <Link href="/programs" className="shrink-0">
            <Button variant="secondary">Choose a split</Button>
          </Link>
        </Card>
      )}

      <Tape title={`Tale of the tape · week of ${format(weekStart, "MMM d")}`}>
        <TapeRow
          label="Tonnage"
          value={formatVolume(volumeThisWeek, unit).split(" ")[0]}
          unit={formatVolume(volumeThisWeek, unit).split(" ")[1]}
          note={volumeMove === null ? undefined : "vs last week"}
          delta={
            <Delta tone={toneOf(volumeMove)}>{deltaLabel(volumeMove)}</Delta>
          }
        />
        <TapeRow
          label="Working sets"
          value={workingSetsThisWeek}
          note={setsMove === null ? undefined : "vs last week"}
          delta={<Delta tone={toneOf(setsMove)}>{deltaLabel(setsMove)}</Delta>}
        />
        <TapeRow
          label="Sessions"
          value={sessionTarget ? `${thisWeek.length}/${sessionTarget}` : thisWeek.length}
          note={sessionTarget ? "programmed" : "no active program"}
          delta={
            sessionTarget ? (
              <Delta tone={sessionsTone}>
                {thisWeek.length >= sessionTarget
                  ? "on pace"
                  : `${sessionTarget - thisWeek.length} to go`}
              </Delta>
            ) : undefined
          }
        />
      </Tape>

      {/* Weak points: four numbers on one scale, so the shortfall is visible
          as a gap rather than four separate figures to hold in your head. */}
      <section className="mt-7">
        <SectionLabel>Weak points · this week</SectionLabel>
        <div className="border-y border-border py-1">
          {weakPointRows.map((r) => (
            <BarRow
              key={r.muscle}
              label={r.label}
              value={r.sets}
              max={weakPointMax}
              low={r.sets === weakPointMin && weakPointMax > weakPointMin}
            />
          ))}
        </div>
      </section>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Training consistency"
          subtitle="Working sets per day"
          className="lg:col-span-2"
          bodyClassName="p-4"
        >
          <ConsistencyHeatmap summaries={summaries} />
        </ChartCard>
        <ChartCard
          title="Weekly sets per muscle"
          subtitle="This week · weak points highlighted · secondary ×0.5"
          className="lg:col-span-2"
        >
          <WeeklySetsChart data={weeklySets} />
        </ChartCard>
        <ChartCard
          title="Muscle balance"
          subtitle="Avg weekly sets per muscle · last 4 weeks"
        >
          <MuscleBalanceRadar data={muscleBalance} />
        </ChartCard>
        <VolumeTrendCard daily={dailyVolume} unit={unit} />
      </div>

      {/* The log. A record book is a table, not six identical cards stacked —
          reading down a column of dates and tonnages is the whole point. */}
      <section className="mt-8">
        <SectionLabel
          action={
            <Link
              href="/history"
              className="font-mono text-[11px] uppercase tracking-wide text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              Full record
            </Link>
          }
        >
          Latest bouts
        </SectionLabel>
        {recent.length === 0 ? (
          <p className="border-y border-border py-8 text-center text-sm text-muted">
            Nothing logged yet. Your first session starts the record.
          </p>
        ) : (
          <div className="border-t border-border">
            {recent.map((s) => (
              <Link
                key={s.session_id}
                href={
                  s.finished_at
                    ? `/history/${s.session_id}`
                    : `/log/${s.session_id}`
                }
                className="group flex items-baseline gap-3 border-b border-border py-3 transition-colors hover:bg-surface/60"
              >
                <span className="w-14 shrink-0 font-mono text-[11px] uppercase tabular-nums text-muted">
                  {s.session_date
                    ? format(parseISO(s.session_date), "dd MMM")
                    : "--"}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate font-display text-[15px] uppercase tracking-wide text-text transition-colors group-hover:text-accent">
                    {s.title ?? "Session"}
                  </span>
                  {!s.finished_at && <Badge variant="accent">Live</Badge>}
                  {!s.template_id && <Badge variant="muted">freeform</Badge>}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
                  {s.working_sets ?? 0} sets
                </span>
                <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-text sm:inline">
                  {formatVolume(Number(s.total_volume ?? 0), unit)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

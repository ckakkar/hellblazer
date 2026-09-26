import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { format, parseISO, startOfISOWeek, subWeeks } from "date-fns";
import { getCurrentWeekSetsPerMuscle } from "@/lib/data/analytics";
import { getSessionSummaries, hasAnySession } from "@/lib/data/sessions";
import { getActiveProgramProgress, getPrograms } from "@/lib/data/programs";
import { getProfile } from "@/lib/data/profile";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { OnboardingHero } from "./onboarding-hero";
import { PRESETS } from "@/lib/presets";
import { FightCardHero } from "@/components/tier/fight-card-hero";
import { getTier } from "@/lib/tiers";
import { getToday, getUnit } from "@/lib/settings";
import { SectionLabel } from "@/components/ui/page-header";
import { Delta, type DeltaTone } from "@/components/ui/tape";
import { ChartCard } from "@/components/ui/chart-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WeeklySetsChart } from "@/components/charts/weekly-sets-chart";
import { VolumeTrendCard } from "@/components/charts/volume-trend-card";
import { ConsistencyHeatmap } from "@/components/charts/consistency-heatmap";
import { formatVolume } from "@/lib/units";
import { WidgetSync } from "@/components/native/widget-sync";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

/** The furthest back anything here looks: the 52-week heatmap and trend, plus a week. */
const HISTORY_WEEKS = 53;

export default async function DashboardPage() {
  const today = await getToday();
  const since = format(subWeeks(startOfISOWeek(parseISO(today)), HISTORY_WEEKS), "yyyy-MM-dd");
  const [
    weeklySets,
    summaries,
    anySession,
    activeProgress,
    programs,
    profile,
    unit,
  ] = await Promise.all([
    getCurrentWeekSetsPerMuscle(),
    // Only the window the page draws: the read stays the same size however
    // long someone has been logging.
    getSessionSummaries({ since }),
    hasAnySession(),
    getActiveProgramProgress(),
    getPrograms(),
    getProfile(),
    getUnit(),
  ]);
  const tier = getTier(profile?.tier);

  // A brand-new lifter (no history, no programs) gets pushed straight at a split.
  const isNewUser = !anySession && programs.length === 0;
  const featuredPreset =
    PRESETS.find((p) => p.days.length === 5) ?? PRESETS[0];
  const presetLite = (p: (typeof PRESETS)[number]) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    days: p.days.length,
    weeks: p.weeks ?? 8,
  });

  // The lifter's week, not the server's: sessions are dated in local time.
  const weekStart = startOfISOWeek(parseISO(today));
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

  // Sessions read against the active program's weekly target, not last week,
  // "4 of 5 programmed" is the honest measure of a training week.
  const sessionTarget = activeProgress?.daysPerWeek ?? null;
  const sessionsTone: DeltaTone = sessionTarget
    ? thisWeek.length >= sessionTarget
      ? "gain"
      : "loss"
    : "flat";

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

  const stats: { label: string; value: string; unit?: string; delta?: React.ReactNode }[] = [
    {
      label: "Volume",
      value: formatVolume(volumeThisWeek, unit).split(" ")[0],
      unit: formatVolume(volumeThisWeek, unit).split(" ")[1],
      delta: <Delta tone={toneOf(volumeMove)}>{deltaLabel(volumeMove)}</Delta>,
    },
    {
      label: "Working sets",
      value: String(workingSetsThisWeek),
      delta: <Delta tone={toneOf(setsMove)}>{deltaLabel(setsMove)}</Delta>,
    },
    {
      label: "Sessions",
      value: sessionTarget ? `${thisWeek.length}/${sessionTarget}` : String(thisWeek.length),
      delta: sessionTarget ? (
        <Delta tone={sessionsTone}>
          {thisWeek.length >= sessionTarget ? "on pace" : `${sessionTarget - thisWeek.length} to go`}
        </Delta>
      ) : undefined,
    },
  ];


  return (
    <div className="space-y-10">
      <WidgetSync />
      {/* The hero, and the next workout overlapping its foot on a phone: one
          screen that says who you are and what to do next, with Start in
          thumb reach. Side by side from `lg`. */}
      <div className="grid lg:grid-cols-[1.35fr_1fr] lg:gap-3">
        <FightCardHero tier={tier} />
        {isNewUser ? null : activeProgress ? (
          <ProgramProgressCard
            progress={activeProgress}
            href={`/programs/${activeProgress.program.id}`}
            className="hb-overlap relative z-10 -mt-14 md:mt-3 lg:mt-0"
          />
        ) : (
          <section className="hb-overlap relative z-10 -mt-14 flex flex-col justify-between gap-5 rounded-3xl bg-surface p-5 sm:p-6 md:mt-3 lg:mt-0">
            <div>
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-text">
                Nothing programmed
              </h2>
              <p className="mt-1 text-[15px] text-muted">
                Pick a split and it schedules your week for you.
              </p>
            </div>
            <Link href="/programs">
              <Button variant="secondary" size="lg" className="w-full">
                Choose a split
              </Button>
            </Link>
          </section>
        )}
      </div>

      {isNewUser && (
        <OnboardingHero
          featured={presetLite(featuredPreset)}
          others={PRESETS.filter((p) => p.id !== featuredPreset.id).map(presetLite)}
        />
      )}

      <section>
        <SectionLabel
          action={
            <span className="text-[13px] text-muted">
              Since {format(weekStart, "EEE d MMM")}
            </span>
          }
        >
          This week
        </SectionLabel>
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl bg-surface py-4">
          {stats.map((st) => (
            <div key={st.label} className="min-w-0 px-4">
              <p className="truncate text-[13px] text-muted">{st.label}</p>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className="font-display text-[1.625rem] leading-none text-text sm:text-[2rem]">
                  {st.value}
                </span>
                {st.unit && <span className="text-[13px] text-muted">{st.unit}</span>}
              </p>
              {st.delta && <div className="mt-1.5">{st.delta}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Consistency"
          subtitle="Working sets per day"
          className="lg:col-span-2"
          bodyClassName="p-5 pt-4"
        >
          <ConsistencyHeatmap summaries={summaries} today={today} />
        </ChartCard>
        <ChartCard title="Sets per muscle" subtitle="This week so far. The band is 10-20 sets, where most growth happens">
          <WeeklySetsChart data={weeklySets} />
        </ChartCard>
        <VolumeTrendCard daily={dailyVolume} unit={unit} today={today} />
      </section>

      <section>
        <SectionLabel
          action={
            <Link
              href="/history"
              className="text-[13px] font-medium text-muted transition-colors hover:text-text"
            >
              See all
            </Link>
          }
        >
          Recent sessions
        </SectionLabel>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[15px] text-muted">
            Nothing logged yet. Your first session starts the record.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
            {recent.map((s) => (
              <Link
                key={s.session_id}
                href={s.finished_at ? `/history/${s.session_id}` : `/log/${s.session_id}`}
                transitionTypes={["nav-forward"]}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ViewTransition name={`session-${s.session_id}`} share="hb-morph" default="none">
                      <span className="truncate text-[15px] font-medium text-text">
                        {s.title ?? "Session"}
                      </span>
                    </ViewTransition>
                    {!s.finished_at && <Badge variant="accent">Live</Badge>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {s.session_date ? format(parseISO(s.session_date), "EEE d MMM") : "No date"}
                    {!s.template_id ? ", freeform" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[15px] text-text">
                    {formatVolume(Number(s.total_volume ?? 0), unit)}
                  </p>
                  <p className="tnum mt-0.5 text-[13px] text-muted">{s.working_sets ?? 0} sets</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

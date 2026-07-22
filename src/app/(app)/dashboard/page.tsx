import Link from "next/link";
import { format, parseISO, startOfISOWeek } from "date-fns";
import { ChevronRight, Dumbbell, Flame, Sparkles } from "lucide-react";
import {
  getCurrentWeekSetsPerMuscle,
  getVolumeTrend,
} from "@/lib/data/analytics";
import { getSessionSummaries } from "@/lib/data/sessions";
import { getActiveProgramProgress, getPrograms } from "@/lib/data/programs";
import { getProfile } from "@/lib/data/profile";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { OnboardingHero } from "./onboarding-hero";
import { PRESETS } from "@/lib/presets";
import { TierLadder } from "@/components/tier/tier-ui";
import { getTier } from "@/lib/tiers";
import { getUnit } from "@/lib/settings";
import { PageHeader, SectionLabel } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ChartCard } from "@/components/ui/chart-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WeeklySetsChart } from "@/components/charts/weekly-sets-chart";
import { VolumeTrendChart } from "@/components/charts/volume-trend-chart";
import { formatVolume } from "@/lib/units";
import { MUSCLE_LABEL, WEAK_POINTS } from "@/lib/muscles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    weeklySets,
    volumeTrend,
    summaries,
    activeProgress,
    programs,
    profile,
    unit,
  ] = await Promise.all([
    getCurrentWeekSetsPerMuscle(),
    getVolumeTrend(12),
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
  const thisWeek = summaries.filter(
    (s) => s.session_date && parseISO(s.session_date) >= weekStart,
  );
  const volumeThisWeek = thisWeek.reduce(
    (n, s) => n + Number(s.total_volume ?? 0),
    0,
  );
  const setsByMuscle = new Map(weeklySets.map((m) => [m.muscle, m.sets]));
  const recent = summaries.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Week of ${format(weekStart, "MMM d")}`}
        action={
          <Link href="/log">
            <Button>
              <Dumbbell className="size-4" />
              Log session
            </Button>
          </Link>
        }
      />

      <Link
        href="/settings"
        className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
      >
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          Rank
        </span>
        <span className="font-impact text-lg uppercase leading-none text-accent">
          {tier ? tier.name : "Unranked"}
        </span>
        <TierLadder rank={tier?.rank ?? 0} className="ml-auto max-w-[160px]" />
      </Link>

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
        <Card className="mb-6 flex flex-col items-start gap-3 border-accent/20 bg-accent/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <div className="text-sm font-medium text-text">
                No active program
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Pick one of your programs and make it active, or load a fresh
                starter split to run for the next few weeks.
              </p>
            </div>
          </div>
          <Link href="/programs" className="shrink-0">
            <Button variant="secondary">Go to Programs</Button>
          </Link>
        </Card>
      )}

      {/* This-week summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Sessions"
          value={thisWeek.length}
          hint="this week"
          icon={<Dumbbell className="size-4" />}
        />
        <StatCard
          label="Volume"
          value={formatVolume(volumeThisWeek, unit).split(" ")[0]}
          unit={unit}
          hint="this week"
        />
        <StatCard
          label="Working sets"
          value={thisWeek.reduce((n, s) => n + Number(s.working_sets ?? 0), 0)}
          hint="this week"
        />
      </div>

      {/* Weak points */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {WEAK_POINTS.map((m) => (
          <StatCard
            key={m}
            label={MUSCLE_LABEL[m]}
            value={Math.round((setsByMuscle.get(m) ?? 0) * 10) / 10}
            unit="sets"
            highlight
            icon={<Flame className="size-4" />}
            hint="weak-point focus"
          />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Weekly sets per muscle"
          subtitle="This week · weak points highlighted · secondary ×0.5"
          className="lg:col-span-2"
        >
          <WeeklySetsChart data={weeklySets} />
        </ChartCard>
        <ChartCard
          title="Volume trend"
          subtitle="Total working-set tonnage per week · last 12 weeks"
          className="lg:col-span-2"
        >
          <VolumeTrendChart data={volumeTrend} unit={unit} />
        </ChartCard>
      </div>

      {/* Recent sessions */}
      <div className="mt-8">
        <SectionLabel
          action={
            <Link
              href="/history"
              className="font-mono text-[11px] uppercase tracking-wide text-muted transition-colors hover:text-accent"
            >
              View all →
            </Link>
          }
        >
          Recent sessions
        </SectionLabel>
        {recent.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">
            No sessions logged yet.
          </Card>
        ) : (
          <div className="grid gap-2">
            {recent.map((s) => (
              <Link
                key={s.session_id}
                href={
                  s.finished_at
                    ? `/history/${s.session_id}`
                    : `/log/${s.session_id}`
                }
              >
                <Card className="flex items-center gap-3 p-3 transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99] active:border-accent/40">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs text-muted">
                    {s.session_date ? format(parseISO(s.session_date), "d") : ""}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-text">
                        {s.title ?? "Session"}
                      </span>
                      {!s.finished_at && (
                        <Badge variant="accent">In progress</Badge>
                      )}
                      {!s.template_id && <Badge variant="muted">freeform</Badge>}
                    </div>
                    <div className="font-mono text-xs text-muted">
                      {s.working_sets ?? 0} sets ·{" "}
                      {formatVolume(Number(s.total_volume ?? 0), unit)}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

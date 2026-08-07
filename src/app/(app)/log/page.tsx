import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { getTemplates } from "@/lib/data/templates";
import { getActiveProgramProgress } from "@/lib/data/programs";
import { ProgramProgressCard } from "@/components/program/program-progress-card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SessionStarter } from "./session-starter";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const [templates, activeProgress] = await Promise.all([
    getTemplates(),
    getActiveProgramProgress(),
  ]);

  // Full template details (movements, target sets/reps) for the preview dropdown,
  // keyed by id: the program-day select only carries exercise counts.
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const previewExercises = (id: string) =>
    (templateById.get(id)?.template_exercise ?? []).map((te) => ({
      name: te.exercise?.name ?? "Exercise",
      muscle: te.exercise?.primary_muscle ?? null,
      targetSets: te.target_sets,
      targetRepRange: te.target_rep_range,
    }));

  // Only offer the days of the current split (the active program), not every
  // template ever loaded. With no active program, fall back to all templates.
  // `programDayId` is what makes a start count toward the block. Options built
  // from the active program carry theirs; anything else is deliberately off-plan.
  // Which day we attach is immaterial to the rotation (progress counts sessions
  // per program, not per day), so the first day using a template is fine.
  type Opt = {
    id: string;
    programDayId: string | null;
    name: string;
    day_label: string | null;
    count: number;
    exercises: ReturnType<typeof previewExercises>;
  };
  const options: Opt[] = [];
  const pushOption = (
    id: string,
    name: string,
    day_label: string | null,
    programDayId: string | null,
  ) => {
    const exercises = previewExercises(id);
    options.push({
      id,
      programDayId,
      name,
      day_label,
      count: exercises.length,
      exercises,
    });
  };
  if (activeProgress) {
    const seen = new Set<string>();
    for (const d of activeProgress.program.program_day) {
      const t = d.workout_template;
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        pushOption(t.id, t.name, t.day_label, d.id);
      }
    }
  } else {
    for (const t of templates) {
      pushOption(t.id, t.name, t.day_label, null);
    }
  }
  const hasProgramNext = Boolean(activeProgress?.nextDay?.template_id);

  // Only promise a week when the block is actually accruing one. A paused,
  // finished, or not-yet-started program still owns the session, but claiming
  // "counts toward Week N" there would be a lie.
  const countsLabel =
    activeProgress &&
    activeProgress.currentWeek &&
    !activeProgress.isCompleted &&
    !activeProgress.isPaused
      ? `Counts toward Week ${activeProgress.currentWeek}`
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Start a workout"
        subtitle="Jump into your program, a template, or go freeform."
      />

      {activeProgress && hasProgramNext && (
        <div className="mb-6">
          <ProgramProgressCard
            progress={activeProgress}
            href={`/programs/${activeProgress.program.id}`}
          />
        </div>
      )}

      {options.length === 0 && !activeProgress ? (
        <div className="grid gap-4">
          <SessionStarter templates={[]} hasActiveProgram={false} countsLabel={null} />
          <EmptyState
            icon={<CalendarRange className="size-6" />}
            title="No program or templates yet"
            body="Build a split on Templates (or load the starter split) to train from a plan."
            action={
              <Link href="/programs">
                <Button variant="secondary">Go to Programs</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <SessionStarter
          templates={options}
          hasActiveProgram={Boolean(activeProgress)}
          countsLabel={countsLabel}
        />
      )}
    </div>
  );
}

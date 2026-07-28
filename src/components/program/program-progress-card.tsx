import Link from "next/link";
import { CalendarRange, CheckCircle2, Dumbbell, Pause } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProgramProgress } from "@/lib/data/programs";
import { StartWorkoutButton } from "./start-workout-button";
import { SkipWorkoutButton } from "./skip-workout-button";
import { PauseResumeButton } from "./program-controls";

export function ProgramProgressCard({
  progress,
  href,
}: {
  progress: ProgramProgress;
  href?: string;
}) {
  const {
    program,
    currentWeek,
    totalWeeks,
    isCompleted,
    isPaused,
    daysPerWeek,
    sessionsThisWeek,
    skipsThisWeek,
    doneThisWeek,
    nextDay,
    weekComplete,
  } = progress;

  const notStarted = !program.start_date;
  const weekPct = currentWeek
    ? Math.min(100, Math.round((currentWeek / totalWeeks) * 100))
    : 0;
  const nextTemplate = nextDay?.workout_template;
  const nextName = nextTemplate?.day_label || nextTemplate?.name || "Workout";
  const nextCount = nextTemplate?.template_exercise.length ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-accent">
            {isCompleted ? "Completed program" : "Active program"}
          </div>
          {href ? (
            <Link
              href={href}
              className="mt-1 block truncate font-display text-lg font-semibold tracking-tight text-text hover:text-accent"
            >
              {program.name}
            </Link>
          ) : (
            <div className="mt-1 truncate font-display text-lg font-semibold tracking-tight text-text">
              {program.name}
            </div>
          )}
        </div>
        <Badge variant="accent" className="shrink-0">
          {notStarted
            ? "Not started"
            : isCompleted
              ? "Done"
              : isPaused
                ? "Paused"
                : `Week ${currentWeek} / ${totalWeeks}`}
        </Badge>
      </div>

      {/* Week progress */}
      <div className="px-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${isCompleted ? 100 : weekPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5" />
            {totalWeeks}-week block
          </span>
          {daysPerWeek > 0 && !isCompleted && !notStarted && (
            <span className="font-mono">
              {doneThisWeek}/{daysPerWeek} this week
              {skipsThisWeek > 0 ? ` · ${skipsThisWeek} skipped` : ""}
            </span>
          )}
        </div>
        {/* This-week adherence dots: logged = solid, skipped = faded */}
        {daysPerWeek > 0 && !isCompleted && !notStarted && (
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: daysPerWeek }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < sessionsThisWeek
                    ? "bg-accent"
                    : i < doneThisWeek
                      ? "bg-accent/40"
                      : "bg-surface-2",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next workout / CTA */}
      <div className="mt-4 flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="size-4 text-accent" />
            Block complete: start a fresh one or extend it.
          </div>
        ) : isPaused ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Pause className="size-4 text-warn" />
              Block paused: your week count is frozen.
            </div>
            <PauseResumeButton
              programId={program.id}
              isPaused
              className="w-full sm:w-auto"
            />
          </>
        ) : nextDay?.template_id ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent">
                <Dumbbell className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  {weekComplete ? "Next week · up first" : "Up next"}
                </div>
                <div className="truncate text-sm font-medium text-text">
                  {nextName}
                  <span className="ml-1 font-mono text-xs text-muted">
                    · {nextCount} exercises
                  </span>
                </div>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <StartWorkoutButton
                programDayId={nextDay.id}
                label="Start workout"
                className="flex-1 sm:flex-none"
              />
              <SkipWorkoutButton programDayId={nextDay.id} />
            </div>
          </>
        ) : (
          <div className="text-sm text-muted">
            Add training days to this program to start.
          </div>
        )}
      </div>
    </Card>
  );
}

import Link from "next/link";
import { CheckCircle2, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramProgress } from "@/lib/data/programs";
import { StartWorkoutButton } from "./start-workout-button";
import { SkipWorkoutButton } from "./skip-workout-button";
import { PauseResumeButton } from "./program-controls";

/**
 * What to do next. The program is context (small, top line); the next
 * workout's name is the headline, and starting it is the one accent action.
 */
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
  const nextTemplate = nextDay?.workout_template;
  const nextName = nextTemplate?.day_label || nextTemplate?.name || "Workout";
  const nextCount = nextTemplate?.template_exercise.length ?? 0;
  const status = notStarted
    ? "Not started"
    : isCompleted
      ? "Complete"
      : isPaused
        ? "Paused"
        : `Week ${currentWeek} of ${totalWeeks}`;

  return (
    <section className="rounded-3xl bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        {href ? (
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            className="min-w-0 truncate text-muted transition-colors hover:text-text"
          >
            {program.name}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-muted">{program.name}</span>
        )}
        <span className="tnum shrink-0 text-muted">{status}</span>
      </div>

      {isCompleted ? (
        <div className="mt-5 flex items-center gap-2.5 text-[15px] text-text">
          <CheckCircle2 className="size-5 text-accent" />
          Block complete. Start a fresh one or extend it.
        </div>
      ) : isPaused ? (
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-[15px] text-text">
            <Pause className="size-5 text-warn" />
            Paused. Your week count is frozen.
          </div>
          <PauseResumeButton programId={program.id} isPaused className="w-full sm:w-auto" />
        </div>
      ) : nextDay?.template_id ? (
        <>
          <p className="mt-5 text-[13px] text-muted">
            {weekComplete ? "Next week, first up" : "Up next"}
          </p>
          <h2 className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-text">
            {nextName}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {nextCount} {nextCount === 1 ? "exercise" : "exercises"}
          </p>

          {daysPerWeek > 0 && !notStarted && (
            <div className="mt-5">
              <div className="flex gap-1.5">
                {Array.from({ length: daysPerWeek }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      i < sessionsThisWeek
                        ? "bg-text"
                        : i < doneThisWeek
                          ? "bg-text/35"
                          : "bg-white/[0.1]",
                    )}
                  />
                ))}
              </div>
              <p className="tnum mt-2 text-[13px] text-muted">
                {doneThisWeek} of {daysPerWeek} this week
                {skipsThisWeek > 0 ? `, ${skipsThisWeek} skipped` : ""}
              </p>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <StartWorkoutButton
              programDayId={nextDay.id}
              label="Start workout"
              variant="accent"
              size="lg"
              className="flex-1"
            />
            <SkipWorkoutButton programDayId={nextDay.id} size="lg" variant="secondary" />
          </div>
        </>
      ) : (
        <p className="mt-5 text-[15px] text-muted">
          Add training days to this program to start.
        </p>
      )}
    </section>
  );
}

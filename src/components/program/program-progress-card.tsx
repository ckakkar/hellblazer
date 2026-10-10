import Link from "next/link";
import { CheckCircle2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProgramProgress } from "@/lib/data/programs";
import type { ActiveSession } from "@/lib/data/sessions";
import { StartWorkoutButton } from "./start-workout-button";
import { SkipWorkoutButton } from "./skip-workout-button";
import { PauseResumeButton } from "./program-controls";

/**
 * What to do next. The program is context (small, top line); the next
 * workout's name is the headline, and starting it is the one accent action.
 * While a workout is under way, that workout is what to do next: the card
 * offers Resume instead of starting the following day on top of it.
 */
export function ProgramProgressCard({
  progress,
  activeSession = null,
  href,
  className,
}: {
  progress: ProgramProgress;
  /** The workout in progress, from getActiveSession(). */
  activeSession?: ActiveSession | null;
  href?: string;
  className?: string;
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
  const live = activeSession && !activeSession.stale ? activeSession : null;
  const extra = Math.max(0, doneThisWeek - daysPerWeek);

  const week =
    daysPerWeek > 0 && !notStarted ? (
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
          {Math.min(doneThisWeek, daysPerWeek)} of {daysPerWeek} this week
          {extra > 0 ? `, ${extra} extra` : ""}
          {skipsThisWeek > 0 ? `, ${skipsThisWeek} skipped` : ""}
        </p>
      </div>
    ) : null;
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
    <section className={cn("rounded-3xl bg-surface p-5 sm:p-6", className)}>
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
      ) : live ? (
        <>
          <p className="mt-5 text-[13px] text-muted">In progress</p>
          <h2 className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-text">
            {live.title ?? "Workout"}
          </h2>
          <p className="tnum mt-0.5 text-[13px] text-muted">
            {live.workingSets} {live.workingSets === 1 ? "set" : "sets"} logged. Finish it to
            start another.
          </p>

          {week}

          <Link href={`/log/${live.id}`} transitionTypes={["nav-forward"]} className="mt-5 block">
            <Button variant="accent" size="lg" className="hb-glow w-full">
              <Play className="size-4" />
              Resume
            </Button>
          </Link>
        </>
      ) : nextDay?.template_id ? (
        <>
          <p className="mt-5 text-[13px] text-muted">
            {weekComplete ? "Next week, first bout" : "Next bout"}
          </p>
          <h2 className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-text">
            {nextName}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {nextCount} {nextCount === 1 ? "exercise" : "exercises"}
          </p>

          {week}

          <div className="mt-5 flex gap-2">
            <StartWorkoutButton
              programDayId={nextDay.id}
              label="Start workout"
              variant="accent"
              size="lg"
              className="hb-glow flex-1"
            />
            <SkipWorkoutButton programDayId={nextDay.id} size="lg" />
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

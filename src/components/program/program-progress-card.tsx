import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Pause, Play, Radio, Watch } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { WorkoutClock } from "@/components/resume-banner";
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
 *
 * On the iPad (`ipad`), where workouts aren't run, the workout under way is
 * one to watch, and the next one is started on the iPhone or the watch.
 */
export function ProgramProgressCard({
  progress,
  activeSession = null,
  href,
  ipad = false,
  className,
}: {
  progress: ProgramProgress;
  /** In the iPad app (useIPadApp or isIPadApp). */
  ipad?: boolean;
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
    isUpcoming,
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
    daysPerWeek > 0 && !notStarted && !isUpcoming ? (
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
                    : "bg-text/[0.1]",
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
    : isUpcoming && program.start_date
      ? `Starts ${format(parseISO(program.start_date), "EEE d MMM")}`
      : isCompleted
      ? "Complete"
      : isPaused
        ? "Paused"
        : `Week ${currentWeek} of ${totalWeeks}`;

  return (
    // `data-live-card` tells the phone's resume banner this page already
    // shows the workout under way (globals.css hides the banner).
    <section
      data-live-card={live && !isCompleted && !isPaused ? "" : undefined}
      className={cn("rounded-3xl bg-surface p-5 sm:p-6", className)}
    >
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
          <p className="tnum mt-5 text-[13px] text-muted">
            {ipad ? "Live" : "In progress"}
            <WorkoutClock startedAt={live.startedAt} prefix=", " />
          </p>
          <h2 className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-text">
            {live.title ?? "Workout"}
          </h2>
          <p className="tnum mt-0.5 text-[13px] text-muted">
            {live.workingSets} {live.workingSets === 1 ? "set" : "sets"} logged
            {ipad ? " so far." : ". Finish it to start another."}
          </p>

          {week}

          {/* Prefetched in full, like the banner's: on a phone this replaces
              the banner as the way back to the logger. */}
          <Link
            href={`/log/${live.id}`}
            prefetch
            transitionTypes={["nav-forward"]}
            className={cn(buttonVariants({ variant: "accent", size: "lg" }), "hb-glow mt-5 w-full")}
          >
            {ipad ? <Radio className="size-4" /> : <Play className="size-4" />}
            {ipad ? "Watch live" : "Resume"}
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

          {ipad ? (
            <div className="mt-5 flex items-center gap-3">
              <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted">
                <Watch className="size-4 shrink-0" />
                Start it on your iPhone or Apple Watch.
              </p>
              <SkipWorkoutButton programDayId={nextDay.id} />
            </div>
          ) : (
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
          )}
        </>
      ) : (
        <p className="mt-5 text-[15px] text-muted">
          Add training days to this program to start.
        </p>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronDown, Loader2, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { repeatSession, startSession } from "@/lib/actions/sessions";
import { PastWorkoutSheet } from "./past-workout-sheet";
import { todayLocalISO } from "@/lib/local-date";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { cn } from "@/lib/utils";
import { useAction } from "@/lib/use-action";
import { Collapse } from "@/components/ui/collapse";

type TemplateExercisePreview = {
  name: string;
  muscle: Muscle | null;
  targetSets: number | null;
  targetRepRange: string | null;
};

type TemplateOption = {
  /** Unique per option: a program day (a template can be on two), else the template. */
  key: string;
  id: string;
  /** Non-null only for days of the active program: this is what makes a start
   *  advance the block. Null options are explicitly off-plan. */
  programDayId: string | null;
  name: string;
  day_label: string | null;
  count: number;
  exercises: TemplateExercisePreview[];
};

/** A recent workout to do again, as the Log page lists it. */
type RecentOption = {
  id: string;
  name: string;
  date: string;
  /** What was done: each exercise with its sets as a lifter writes them. */
  exercises: { name: string; sets: string }[];
};

export function SessionStarter({
  templates,
  recent = [],
  hasActiveProgram = false,
  countsLabel = null,
  autoStart = null,
}: {
  templates: TemplateOption[];
  /** The last few workouts, newest first: started again with what was done as the targets. */
  recent?: RecentOption[];
  /** Drives the "won't touch your block" copy: only meaningful with a program. */
  hasActiveProgram?: boolean;
  /** e.g. "Counts toward Week 3", or null when the block isn't accruing. */
  countsLabel?: string | null;
  /** Start this one right away: Siri or Spotlight asked for it. */
  autoStart?: { templateId: string; programDayId: string | null } | null;
}) {
  const [pending, start] = useAction("start the workout");
  const [chosen, setChosen] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Mounted fresh each time it opens, so its defaults are now's.
  const [past, setPast] = useState(0);
  const [pastOpen, setPastOpen] = useState(false);

  function again(sessionId: string) {
    setChosen(`again:${sessionId}`);
    start(async () => {
      await repeatSession({ sessionId, localDate: todayLocalISO() });
    });
  }

  function begin(templateId: string | null, programDayId: string | null = null) {
    setChosen(programDayId ?? templateId ?? "freeform");
    start(async () => {
      await startSession({
        templateId,
        programDayId,
        localDate: todayLocalISO(),
      });
    });
  }

  const beginRef = useRef(begin);
  useEffect(() => {
    beginRef.current = begin;
  });
  const autoTemplate = autoStart?.templateId ?? null;
  const autoDay = autoStart?.programDayId ?? null;
  useEffect(() => {
    if (!autoTemplate) return;
    const frame = window.requestAnimationFrame(() => beginRef.current(autoTemplate, autoDay));
    return () => window.cancelAnimationFrame(frame);
  }, [autoTemplate, autoDay]);

  const freeform = (
    <button
      disabled={pending}
      onClick={() => begin(null)}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05] disabled:opacity-60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        {pending && chosen === "freeform" ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : (
          <Zap className="size-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-text">Start empty</span>
        <span className="mt-0.5 block text-[13px] text-muted">
          Add exercises as you go
          {hasActiveProgram ? ". Doesn't count toward your program." : "."}
        </span>
      </span>
    </button>
  );

  const pastRow = (
    <button
      disabled={pending}
      onClick={() => {
        setPast((k) => k + 1);
        setPastOpen(true);
      }}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05] disabled:opacity-60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        <CalendarClock className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-text">Log a past workout</span>
        <span className="mt-0.5 block text-[13px] text-muted">One you did without logging it as you went.</span>
      </span>
    </button>
  );

  return (
    <div className="space-y-8">
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 px-1 text-[19px] font-semibold tracking-[-0.02em] text-text">Recent workouts</h2>
          <div className="divide-y divide-text/[0.06] overflow-hidden rounded-2xl bg-surface">
            {recent.map((w) => {
              const key = `again:${w.id}`;
              const expanded = openId === key;
              const starting = pending && chosen === key;
              return (
                <div key={w.id}>
                  {/* Tap to see what was done, as for a template. */}
                  <button
                    onClick={() => setOpenId(expanded ? null : key)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-text">{w.name}</span>
                      <span className="tnum mt-0.5 block truncate text-[13px] text-muted">
                        {format(parseISO(w.date), "EEE d MMM")}, {w.exercises.length}{" "}
                        {w.exercises.length === 1 ? "exercise" : "exercises"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-[18px] shrink-0 text-muted transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>

                  <Collapse open={expanded} className="px-4 pb-4">
                    <ol className="divide-y divide-text/[0.05] rounded-xl bg-surface-2/60">
                      {w.exercises.map((ex, i) => (
                        <li key={i} className="flex gap-3 px-3.5 py-2.5">
                          <span className="tnum w-4 shrink-0 text-right text-[13px] leading-5 text-muted">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] leading-5 text-text">{ex.name}</span>
                            {ex.sets && <span className="tnum block text-[13px] leading-5 text-muted">{ex.sets}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-3 px-1 text-[13px] leading-5 text-muted">
                      Today&apos;s targets come from what you did last time
                      {hasActiveProgram ? ". Doesn't count toward your program." : "."}
                    </p>
                    <Button
                      variant="accent"
                      size="lg"
                      className="mt-3 w-full"
                      disabled={pending}
                      onClick={() => again(w.id)}
                    >
                      {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                      Do it again
                    </Button>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {templates.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-text">
              {hasActiveProgram ? "Your program" : "Templates"}
            </h2>
            {countsLabel && <span className="text-[13px] text-muted">{countsLabel}</span>}
          </div>
          <div className="divide-y divide-text/[0.06] overflow-hidden rounded-2xl bg-surface">
            {templates.map((t) => {
              const expanded = openId === t.key;
              const starting = pending && chosen === t.key;
              return (
                <div key={t.key}>
                  {/* Tap to preview, not to start. */}
                  <button
                    onClick={() => setOpenId(expanded ? null : t.key)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-text/[0.03] active:bg-text/[0.05]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-text">
                        {t.day_label || t.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {t.day_label ? `${t.name}, ` : ""}
                        {t.count} {t.count === 1 ? "exercise" : "exercises"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-[18px] shrink-0 text-muted transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>

                  <Collapse open={expanded} className="px-4 pb-4">
                    {t.exercises.length > 0 ? (
                      <ol className="divide-y divide-text/[0.05] rounded-xl bg-surface-2/60">
                        {t.exercises.map((ex, i) => (
                          <li key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                            <span className="tnum w-4 shrink-0 text-right text-[13px] text-muted">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14px] text-text">
                              {ex.name}
                            </span>
                            {ex.muscle && (
                              <span className="hidden text-[13px] text-muted sm:inline">
                                {MUSCLE_LABEL[ex.muscle]}
                              </span>
                            )}
                            <span className="tnum shrink-0 text-[13px] text-muted">
                              {ex.targetSets ?? 3} × {ex.targetRepRange || "-"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="py-3 text-center text-[14px] text-muted">
                        No exercises in this template yet.
                      </p>
                    )}
                    <Button
                      variant="accent"
                      size="lg"
                      className="mt-3 w-full"
                      disabled={pending}
                      onClick={() => begin(t.id, t.programDayId)}
                    >
                      {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                      Start workout
                    </Button>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 px-1 text-[19px] font-semibold tracking-[-0.02em] text-text">
          {templates.length > 0 || recent.length > 0 ? "Or" : "Freeform"}
        </h2>
        <div className="space-y-2">
          {freeform}
          {pastRow}
        </div>
      </section>

      <PastWorkoutSheet key={past} open={pastOpen} onClose={() => setPastOpen(false)} />
    </div>
  );
}

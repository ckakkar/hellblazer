"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startSession } from "@/lib/actions/sessions";
import { todayLocalISO } from "@/lib/local-date";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { cn } from "@/lib/utils";

type TemplateExercisePreview = {
  name: string;
  muscle: Muscle | null;
  targetSets: number | null;
  targetRepRange: string | null;
};

type TemplateOption = {
  id: string;
  /** Non-null only for days of the active program: this is what makes a start
   *  advance the block. Null options are explicitly off-plan. */
  programDayId: string | null;
  name: string;
  day_label: string | null;
  count: number;
  exercises: TemplateExercisePreview[];
};

export function SessionStarter({
  templates,
  hasActiveProgram = false,
  countsLabel = null,
}: {
  templates: TemplateOption[];
  /** Drives the "won't touch your block" copy: only meaningful with a program. */
  hasActiveProgram?: boolean;
  /** e.g. "Counts toward Week 3", or null when the block isn't accruing. */
  countsLabel?: string | null;
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function begin(templateId: string | null, programDayId: string | null = null) {
    setChosen(templateId ?? "freeform");
    start(async () => {
      await startSession({
        templateId,
        programDayId,
        localDate: todayLocalISO(),
      });
    });
  }

  const freeform = (
    <button
      disabled={pending}
      onClick={() => begin(null)}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] disabled:opacity-60"
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

  return (
    <div className="space-y-8">
      {templates.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-text">
              {hasActiveProgram ? "Your program" : "Templates"}
            </h2>
            {countsLabel && <span className="text-[13px] text-muted">{countsLabel}</span>}
          </div>
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
            {templates.map((t) => {
              const expanded = openId === t.id;
              const starting = pending && chosen === t.id;
              return (
                <div key={t.id}>
                  {/* Tap to preview, not to start. */}
                  <button
                    onClick={() => setOpenId(expanded ? null : t.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
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

                  {expanded && (
                    <div className="px-4 pb-4">
                      {t.exercises.length > 0 ? (
                        <ol className="divide-y divide-white/[0.05] rounded-xl bg-surface-2/60">
                          {t.exercises.map((ex, i) => (
                            <li key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                              <span className="tnum w-4 shrink-0 text-right text-[13px] text-muted/70">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 px-1 text-[19px] font-semibold tracking-[-0.02em] text-text">
          {templates.length > 0 ? "Or" : "Freeform"}
        </h2>
        {freeform}
      </section>
    </div>
  );
}

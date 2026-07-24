"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Dumbbell, Loader2, Play, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  name: string;
  day_label: string | null;
  count: number;
  exercises: TemplateExercisePreview[];
};

export function SessionStarter({ templates }: { templates: TemplateOption[] }) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function begin(templateId: string | null) {
    setChosen(templateId ?? "freeform");
    start(async () => {
      await startSession({ templateId, localDate: todayLocalISO() });
    });
  }

  return (
    <div className="grid gap-4">
      <button
        disabled={pending}
        onClick={() => begin(null)}
        className={cn(
          "group flex items-center gap-4 rounded-lg border border-border bg-surface p-5 text-left transition-[transform,border-color] hover:border-accent/40 active:scale-[0.99]",
          pending && chosen === "freeform" && "border-accent/60",
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {pending && chosen === "freeform" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Zap className="size-5" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-text">Freeform battle</div>
          <div className="text-xs text-muted">
            Start empty and add exercises as you go
          </div>
        </div>
      </button>

      {templates.length > 0 && (
        <div>
          <div className="mb-2 mt-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
            From a template
          </div>
          <div className="grid gap-3">
            {templates.map((t) => {
              const expanded = openId === t.id;
              const starting = pending && chosen === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "overflow-hidden rounded-lg border bg-surface transition-colors",
                    expanded ? "border-accent/40" : "border-border",
                  )}
                >
                  {/* Header — tap to preview, not to start */}
                  <button
                    onClick={() => setOpenId(expanded ? null : t.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                      <Dumbbell className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {t.name}
                        </span>
                        {t.day_label && (
                          <Badge variant="muted">{t.day_label}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {t.count} exercise{t.count === 1 ? "" : "s"} ·{" "}
                        {expanded ? "tap to collapse" : "tap to preview"}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-muted transition-transform duration-200",
                        expanded && "rotate-180 text-accent",
                      )}
                    />
                  </button>

                  {/* Preview — upcoming movements without starting */}
                  {expanded && (
                    <div className="border-t border-border p-3">
                      {t.exercises.length > 0 ? (
                        <ul className="grid gap-1.5">
                          {t.exercises.map((ex, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-3 rounded-md bg-surface-2/40 px-3 py-2"
                            >
                              <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/60">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm text-text">
                                {ex.name}
                              </span>
                              {ex.muscle && (
                                <Badge
                                  variant="muted"
                                  className="hidden sm:inline-flex"
                                >
                                  {MUSCLE_LABEL[ex.muscle]}
                                </Badge>
                              )}
                              <span className="shrink-0 font-mono text-xs text-muted">
                                {ex.targetSets ?? 3} × {ex.targetRepRange || "—"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-1 py-3 text-center text-sm text-muted">
                          No exercises in this template yet.
                        </p>
                      )}
                      <Button
                        size="lg"
                        className="mt-3 w-full"
                        disabled={pending}
                        onClick={() => begin(t.id)}
                      >
                        {starting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                        Start workout
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

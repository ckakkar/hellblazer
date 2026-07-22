"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Repeat2, Search } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StartWorkoutButton } from "@/components/program/start-workout-button";
import { MUSCLE_LABEL, type Muscle } from "@/lib/muscles";
import { swapTemplateExercise } from "@/lib/actions/templates";
import type { Exercise } from "@/lib/data/exercises";
import type { TemplateWithExercises } from "@/lib/data/templates";

type Row = {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscle: Muscle;
  targetSets: number | null;
  targetReps: string | null;
  note: string | null;
};

/**
 * Read-only look at a programmed day — its movements, target sets/reps and
 * notes — without starting the workout. Any movement can be swapped inline
 * (which becomes that day's new default), and the day starts from here.
 */
export function DayPreview({
  onClose,
  template,
  programDayId,
  dayTitle,
  exercises,
}: {
  onClose: () => void;
  template: TemplateWithExercises | null;
  programDayId: string;
  dayTitle: string;
  exercises: Exercise[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (template?.template_exercise ?? []).map((te) => ({
      id: te.id,
      exerciseId: te.exercise_id,
      name: te.exercise?.name ?? "Exercise",
      primaryMuscle: te.exercise?.primary_muscle ?? "chest",
      targetSets: te.target_sets,
      targetReps: te.target_rep_range,
      note: te.note,
    })),
  );
  const [swapRowId, setSwapRowId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [, start] = useTransition();

  const swapRow = rows.find((r) => r.id === swapRowId) ?? null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = swapRow
      ? exercises.filter((e) => e.id !== swapRow.exerciseId)
      : exercises;
    if (!s) return base;
    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(s) ||
        MUSCLE_LABEL[e.primary_muscle].toLowerCase().includes(s) ||
        (e.equipment ?? "").toLowerCase().includes(s),
    );
  }, [q, exercises, swapRow]);

  function doSwap(newExerciseId: string) {
    const meta = exercises.find((e) => e.id === newExerciseId);
    if (!meta || !swapRowId) return;
    const rowId = swapRowId;
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              exerciseId: meta.id,
              name: meta.name,
              primaryMuscle: meta.primary_muscle,
            }
          : r,
      ),
    );
    setSwapRowId(null);
    setQ("");
    start(async () => {
      await swapTemplateExercise({ id: rowId, newExerciseId });
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={swapRow ? "Swap movement" : dayTitle}
      footer={
        swapRow ? null : (
          <div className="flex flex-col gap-2">
            <StartWorkoutButton
              programDayId={programDayId}
              label="Start this workout"
              size="lg"
              className="w-full"
            />
            <Link
              href="/templates"
              className="text-center text-xs text-muted transition-colors hover:text-accent"
            >
              Edit sets, reps &amp; order in Templates →
            </Link>
          </div>
        )
      }
    >
      {swapRow ? (
        <div>
          <div className="sticky top-0 z-10 border-b border-border bg-surface p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Swap “${swapRow.name}” for…`}
                className="pl-9"
              />
            </div>
            <p className="mt-2 px-0.5 text-xs text-muted">
              Becomes this day’s new default going forward.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => doSwap(e.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">{e.name}</div>
                    <div className="truncate text-xs text-muted">
                      {MUSCLE_LABEL[e.primary_muscle]}
                      {e.equipment ? ` · ${e.equipment}` : ""}
                    </div>
                  </div>
                  {e.user_id && (
                    <span className="shrink-0 text-xs text-accent">custom</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-4">
          <ul className="grid gap-2">
            {rows.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-text">{r.name}</span>
                    <Badge variant="muted">
                      {MUSCLE_LABEL[r.primaryMuscle]}
                    </Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {r.targetSets ?? 3} × {r.targetReps || "—"}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSwapRowId(r.id);
                    setQ("");
                  }}
                  aria-label={`Swap ${r.name}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  <Repeat2 className="size-4" />
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-1 py-6 text-center text-sm text-muted">
                This day has no exercises yet.
              </li>
            )}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

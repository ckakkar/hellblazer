"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MUSCLE_CHART_ORDER, MUSCLE_LABEL, isWeakPoint } from "@/lib/muscles";

type ExerciseOption = { exercise_id: string; exercise_name: string };

export function ProgressControls({
  tab,
  exercises,
  selectedExercise,
  selectedMuscle,
}: {
  tab: "exercise" | "muscle";
  exercises: ExerciseOption[];
  selectedExercise?: string;
  selectedMuscle: string;
}) {
  const router = useRouter();

  function go(next: { tab?: string; exercise?: string; muscle?: string }) {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    const ex = next.exercise ?? selectedExercise;
    const mu = next.muscle ?? selectedMuscle;
    if ((next.tab ?? tab) === "exercise" && ex) params.set("exercise", ex);
    if ((next.tab ?? tab) === "muscle" && mu) params.set("muscle", mu);
    router.push(`/progress?${params.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
        {(["exercise", "muscle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => go({ tab: t })}
            aria-pressed={tab === t}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
              tab === t
                ? "bg-accent text-bg"
                : "text-muted hover:text-text",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "exercise" ? (
        <Select
          value={selectedExercise ?? ""}
          onChange={(e) => go({ exercise: e.target.value })}
          className="sm:w-64"
          disabled={exercises.length === 0}
        >
          {exercises.length === 0 && <option value="">No data yet</option>}
          {exercises.map((e) => (
            <option key={e.exercise_id} value={e.exercise_id}>
              {e.exercise_name}
            </option>
          ))}
        </Select>
      ) : (
        <Select
          value={selectedMuscle}
          onChange={(e) => go({ muscle: e.target.value })}
          className="sm:w-64"
        >
          {MUSCLE_CHART_ORDER.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL[m]}
              {isWeakPoint(m) ? " ★" : ""}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

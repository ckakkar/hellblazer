"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { MUSCLE_CHART_ORDER, MUSCLE_LABEL, isWeakPoint } from "@/lib/muscles";
import { Segmented } from "@/components/ui/segmented";

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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Segmented
        kind="tabs"
        label="Progress by"
        options={[
          { value: "exercise", label: "Lifts" },
          { value: "muscle", label: "Muscles" },
        ]}
        value={tab}
        onChange={(t) => go({ tab: t })}
        className="self-start"
      />

      {tab === "exercise" ? (
        <Select
          value={selectedExercise ?? ""}
          onChange={(e) => go({ exercise: e.target.value })}
          aria-label="Exercise"
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
          aria-label="Muscle"
          className="sm:w-64"
        >
          {MUSCLE_CHART_ORDER.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABEL[m]}
              {isWeakPoint(m) ? " (weak point)" : ""}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

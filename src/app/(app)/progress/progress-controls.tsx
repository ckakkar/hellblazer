"use client";

import { createContext, use, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MUSCLE_CHART_ORDER, MUSCLE_LABEL, isWeakPoint, type Muscle } from "@/lib/muscles";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type ExerciseOption = { exercise_id: string; exercise_name: string };
type View = { tab: "exercise" | "muscle"; exercise?: string; muscle: string };

/**
 * Switching lift or muscle asks the server for the new page, which takes a
 * moment. The pickers show the choice at once (optimistic) and the page
 * under them dims with a line saying what's loading, so a tap never looks
 * like it did nothing.
 */
const Switching = createContext<{ pending: boolean; loading: string | null }>({ pending: false, loading: null });

export function ProgressShell({
  view,
  exercises,
  children,
}: {
  view: View;
  exercises: ExerciseOption[];
  /** [the pickers' slot is filled here, the page below] */
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, show] = useOptimistic(view);

  function go(next: Partial<View>) {
    const want = { ...shown, ...next };
    const params = new URLSearchParams();
    params.set("tab", want.tab);
    if (want.tab === "exercise" && want.exercise) params.set("exercise", want.exercise);
    if (want.tab === "muscle" && want.muscle) params.set("muscle", want.muscle);
    startTransition(() => {
      show(want);
      router.push(`/progress?${params.toString()}`, { scroll: false });
    });
  }

  const loading = !pending
    ? null
    : shown.tab === "muscle"
      ? MUSCLE_LABEL[shown.muscle as Muscle] ?? "Muscles"
      : exercises.find((e) => e.exercise_id === shown.exercise)?.exercise_name ?? "Lifts";

  return (
    <Switching value={{ pending, loading }}>
      <ProgressControls view={shown} exercises={exercises} go={go} />
      {children}
    </Switching>
  );
}

function ProgressControls({
  view,
  exercises,
  go,
}: {
  view: View;
  exercises: ExerciseOption[];
  go: (next: Partial<View>) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Segmented
        kind="tabs"
        label="Progress by"
        options={[
          { value: "exercise", label: "Lifts" },
          { value: "muscle", label: "Muscles" },
        ]}
        value={view.tab}
        onChange={(t) => go({ tab: t })}
        className="self-start"
      />

      {view.tab === "exercise" ? (
        <Select
          value={view.exercise ?? ""}
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
          value={view.muscle}
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

/** The page under the pickers: dimmed, with what's coming named, while it loads. */
export function ProgressBody({ children }: { children: ReactNode }) {
  const { pending, loading } = use(Switching);
  return (
    <div className="relative" aria-busy={pending || undefined}>
      {loading && (
        <p
          role="status"
          className="hb-fade-in sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 mx-auto -mb-9 flex h-9 w-fit items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] text-text shadow-lg shadow-black/30 md:top-6"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
          <span>
            Loading <span className="font-semibold">{loading}</span>
          </span>
        </p>
      )}
      <div
        className={cn(
          "transition-opacity duration-200 ease-out",
          pending && "pointer-events-none opacity-35",
        )}
      >
        {children}
      </div>
    </div>
  );
}

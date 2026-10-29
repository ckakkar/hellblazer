"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { SearchField } from "@/components/ui/search-field";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { matchesExercise } from "@/lib/exercise-search";
import type { Exercise } from "@/lib/data/exercises";
import { useUsualLifts } from "@/components/usual-lifts";

export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
  title = "Add exercise",
  hint,
  usual: given,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (exerciseId: string) => void;
  title?: string;
  /** A line under the search saying what picking one does. */
  hint?: string;
  /** The lifter's most-trained lifts, most first: listed ahead of the rest. From the page's UsualLiftsProvider unless given. */
  usual?: string[];
}) {
  const fromPage = useUsualLifts();
  const usual = given ?? fromPage;
  const [q, setQ] = useState("");

  // Autofocusing the search field pops the on-screen keyboard the moment the
  // sheet opens, hiding most of the list, so only do it for a fine pointer.
  // Safe to read at render: Sheet portals after hydration, so this subtree
  // only ever mounts client-side.
  const finePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches;

  /** Reset the query on the way out, so reopening isn't pre-filtered. */
  function close() {
    setQ("");
    onClose();
  }

  // A retired custom exercise stays in history but out of the pickers. The
  // lifter's usual lifts come first, under their own head until a search.
  const rank = useMemo(() => new Map(usual.map((id, i) => [id, i])), [usual]);
  const filtered = useMemo(
    () =>
      exercises
        .filter((e) => !e.archived_at && matchesExercise(e, q))
        .toSorted((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)),
    [q, exercises, rank],
  );
  const yours = q.trim() ? 0 : filtered.filter((e) => rank.has(e.id)).length;

  return (
    <Sheet open={open} onClose={close} title={title} fill>
      <div className="sticky top-0 z-10 border-b border-border bg-surface p-3">
        <SearchField
          autoFocus={finePointer}
          label="Search exercises"
          value={q}
          onValueChange={setQ}
          placeholder="Search exercises…"
        />
        {hint && <p className="mt-2 px-1 text-[13px] text-muted">{hint}</p>}
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((e, i) => (
          <li key={e.id}>
            {yours > 0 && (i === 0 || i === yours) && (
              <p className="bg-surface px-4 pb-1.5 pt-4 text-[13px] font-medium text-muted">
                {i === 0 ? "Your lifts" : "Every exercise"}
              </p>
            )}
            <button
              onClick={() => {
                onPick(e.id);
                close();
              }}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-text">{e.name}</div>
                <div className="truncate text-xs text-muted">
                  {MUSCLE_LABEL[e.primary_muscle]}
                  {e.equipment ? `, ${e.equipment}` : ""}
                  {e.mechanic ? `, ${e.mechanic}` : ""}
                </div>
              </div>
              {e.user_id && (
                <span className="shrink-0 text-[13px] text-muted">Custom</span>
              )}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted">
            No exercises match “{q}”.
          </li>
        )}
      </ul>
    </Sheet>
  );
}

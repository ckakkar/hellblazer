"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { MUSCLE_LABEL } from "@/lib/muscles";
import type { Exercise } from "@/lib/data/exercises";

export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onPick: (exerciseId: string) => void;
}) {
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(s) ||
        MUSCLE_LABEL[e.primary_muscle].toLowerCase().includes(s) ||
        (e.equipment ?? "").toLowerCase().includes(s),
    );
  }, [q, exercises]);

  return (
    <Sheet open={open} onClose={close} title="Add exercise">
      <div className="sticky top-0 z-10 border-b border-border bg-surface p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus={finePointer}
            aria-label="Search exercises"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercises…"
            className="pl-9"
          />
        </div>
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((e) => (
          <li key={e.id}>
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
                  {e.equipment ? ` · ${e.equipment}` : ""}
                  {e.mechanic ? ` · ${e.mechanic}` : ""}
                </div>
              </div>
              {e.user_id && (
                <span className="shrink-0 text-xs text-accent">custom</span>
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

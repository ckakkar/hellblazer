"use client";

import { useOptimistic, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import {
  fromDisplayWeight,
  toDisplayBodyweight,
  trimNum,
  type Unit,
} from "@/lib/units";
import { logBodyweight, deleteBodyweight } from "@/lib/actions/bodyweight";
import type { BodyweightLog } from "@/lib/data/bodyweight";
import { selectAllOnFocus } from "@/lib/utils";
import { healthSyncOn, withNative } from "@/lib/native-plugins";
import { useAction } from "@/lib/use-action";
import { SwipeRow } from "@/components/ui/swipe-row";
import { useListGlide } from "@/components/ui/use-list-glide";

type Edit = { kind: "add"; log: BodyweightLog } | { kind: "remove"; id: string };

/** The entries after an edit, newest date first, as the server lists them. */
function editLogs(logs: BodyweightLog[], edit: Edit): BodyweightLog[] {
  if (edit.kind === "remove") return logs.filter((l) => l.id !== edit.id);
  return [edit.log, ...logs].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

/** Entries listed before "Show all": the chart above already shows the trend. */
const RECENT = 5;

export function BodyweightManager({
  logs,
  unit,
  today,
}: {
  logs: BodyweightLog[];
  unit: Unit;
  /** The lifter's local date from the server, so the default matches on
   *  both sides of hydration. */
  today: string;
}) {
  const [, start] = useAction("save the change");
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [showAll, setShowAll] = useState(false);
  // A new entry or a deleted one shows at once; the server catches up.
  const [entries, applyLocal] = useOptimistic(logs, editLogs);
  const shown = showAll ? entries : entries.slice(0, RECENT);
  const list = useRef<HTMLUListElement>(null);
  useListGlide(list, shown.map((l) => l.id).join());

  function submit() {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    const kg = fromDisplayWeight(w, unit);
    const typed = weight;
    setWeight("");
    start(
      async () => {
        applyLocal({
          kind: "add",
          log: { id: `pending-${Date.now()}`, user_id: "", date, weight_kg: kg, created_at: new Date().toISOString() },
        });
        await logBodyweight({ date, weightKg: kg });
        // In the iOS app with Health sync on, the entry goes to Apple Health
        // too: timed now for today, midday for an earlier date.
        if (healthSyncOn()) {
          const when = date === today ? Date.now() : new Date(`${date}T12:00:00`).getTime();
          withNative((api) => api.saveBodyweight({ kg, date: when }));
        }
      },
      // Didn't go through: the number goes back in the field.
      () => setWeight(typed),
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-2 sm:flex-row">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="sm:w-44"
          aria-label="Bodyweight date"
        />
        <div className="flex gap-2">
          <Input
            type="number"
            onFocus={selectAllOnFocus}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={`Weight (${unit})`}
            className="flex-1"
            aria-label="Bodyweight"
          />
          <Button onClick={submit} disabled={!weight}>
            <Plus className="size-4" />
            Log
          </Button>
        </div>
      </div>

      {entries.length > 0 && (
        <ul ref={list} className="mt-4 divide-y divide-text/[0.08] overflow-hidden border-y border-text/[0.12]">
          {shown.map((l) => (
            // `justify-between` with no gap and nothing to stop either side
            // wrapping put the date hard against the weight at 360px and broke
            // both onto two lines at 320px. The date now truncates, the reading
            // never wraps, and the two are held apart.
            // On a touch screen an entry swipes away, as in Mail; with a
            // mouse or trackpad it has a delete button.
            <li key={l.id} data-glide={l.id}>
              <SwipeRow
                onAction={() =>
                  start(async () => {
                    applyLocal({ kind: "remove", id: l.id });
                    await deleteBodyweight({ id: l.id });
                  })
                }
              >
                <div className="flex min-h-12 items-center gap-3 bg-bg px-1 py-2">
                  <span className="min-w-0 flex-1 truncate tnum text-[15px] text-muted">
                    {format(parseISO(l.date), "d MMM yyyy")}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap tnum text-[15px] text-text">
                      {trimNum(toDisplayBodyweight(l.weight_kg, unit))}
                      <span className="ml-1 text-[13px] text-muted">{unit}</span>
                    </span>
                    {/* Swipe on touch, and a button everywhere, so a tap or
                        a screen reader can delete too. */}
                    <div>
                      <ConfirmIconButton
                        label="Delete entry"
                        confirmLabel="Tap again to delete entry"
                        onConfirm={() =>
                          start(async () => {
                            applyLocal({ kind: "remove", id: l.id });
                            await deleteBodyweight({ id: l.id });
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}
      {entries.length > RECENT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-1 inline-flex h-10 items-center px-1 text-[13px] text-muted transition-colors hover:text-text"
        >
          {showAll ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}

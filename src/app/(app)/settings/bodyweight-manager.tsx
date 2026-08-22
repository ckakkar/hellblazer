"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmIconButton } from "@/components/ui/confirm-icon-button";
import {
  fromDisplayWeight,
  toDisplayWeight,
  trimNum,
  type Unit,
} from "@/lib/units";
import { logBodyweight, deleteBodyweight } from "@/lib/actions/bodyweight";
import type { BodyweightLog } from "@/lib/data/bodyweight";
import { selectAllOnFocus } from "@/lib/utils";

export function BodyweightManager({
  logs,
  unit,
}: {
  logs: BodyweightLog[];
  unit: Unit;
}) {
  const [pending, start] = useTransition();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weight, setWeight] = useState("");

  function submit() {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    start(async () => {
      await logBodyweight({ date, weightKg: fromDisplayWeight(w, unit) });
      setWeight("");
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
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
          <Button onClick={submit} disabled={pending || !weight}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Log
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {logs.map((l) => (
            // `justify-between` with no gap and nothing to stop either side
            // wrapping put the date hard against the weight at 360px and broke
            // both onto two lines at 320px. The date now truncates, the reading
            // never wraps, and the two are held apart.
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-muted">
                {format(parseISO(l.date), "d MMM yyyy")}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="whitespace-nowrap font-mono text-sm tabular-nums text-text">
                  {trimNum(toDisplayWeight(l.weight_kg, unit))} {unit}
                </span>
                <ConfirmIconButton
                  label="Delete entry"
                  confirmLabel="Tap again to delete entry"
                  disabled={pending}
                  onConfirm={() =>
                    start(async () => {
                      await deleteBodyweight({ id: l.id });
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

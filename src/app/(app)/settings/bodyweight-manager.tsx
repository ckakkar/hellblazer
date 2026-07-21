"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fromDisplayWeight,
  toDisplayWeight,
  trimNum,
  type Unit,
} from "@/lib/units";
import { logBodyweight, deleteBodyweight } from "@/lib/actions/bodyweight";
import type { BodyweightLog } from "@/lib/data/bodyweight";

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
            <li
              key={l.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="font-mono text-sm text-muted">
                {format(parseISO(l.date), "EEE, MMM d yyyy")}
              </span>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-text">
                  {trimNum(toDisplayWeight(l.weight_kg, unit))} {unit}
                </span>
                <button
                  aria-label="Delete entry"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteBodyweight({ id: l.id });
                    })
                  }
                  className="text-muted transition-colors hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Unit } from "@/lib/units";
import { setUnit } from "@/lib/actions/settings";

export function UnitToggle({ current }: { current: Unit }) {
  const [unit, setLocal] = useState<Unit>(current);
  const [, start] = useTransition();

  function choose(u: Unit) {
    if (u === unit) return;
    setLocal(u);
    start(async () => {
      await setUnit({ unit: u });
    });
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {(["kg", "lb"] as const).map((u) => (
        <button
          key={u}
          onClick={() => choose(u)}
          aria-pressed={unit === u}
          aria-label={u === "kg" ? "Kilograms" : "Pounds"}
          className={cn(
            "min-w-16 rounded-md px-4 py-2 text-sm font-medium uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
            unit === u ? "bg-accent text-bg" : "text-muted hover:text-text",
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

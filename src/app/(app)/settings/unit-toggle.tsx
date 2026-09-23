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
    <div className="inline-flex rounded-full bg-white/[0.06] p-0.5">
      {(["kg", "lb"] as const).map((u) => (
        <button
          key={u}
          onClick={() => choose(u)}
          aria-pressed={unit === u}
          aria-label={u === "kg" ? "Kilograms" : "Pounds"}
          className={cn(
            "h-8 min-w-14 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text/40",
            unit === u ? "bg-white/[0.12] text-text" : "text-muted hover:text-text",
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

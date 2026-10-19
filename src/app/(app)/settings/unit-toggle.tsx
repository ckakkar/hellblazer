"use client";

import { useState } from "react";
import type { Unit } from "@/lib/units";
import { setUnit } from "@/lib/actions/settings";
import { useAction } from "@/lib/use-action";
import { Segmented } from "@/components/ui/segmented";

export function UnitToggle({ current }: { current: Unit }) {
  const [unit, setLocal] = useState<Unit>(current);
  const [, start] = useAction("change units");

  function choose(u: Unit) {
    if (u === unit) return;
    setLocal(u);
    start(
      async () => {
        await setUnit({ unit: u });
      },
      () => setLocal(unit),
    );
  }

  return (
    <Segmented
      label="Units"
      options={[
        { value: "kg", label: "kg", ariaLabel: "Kilograms" },
        { value: "lb", label: "lb", ariaLabel: "Pounds" },
      ]}
      value={unit}
      onChange={choose}
      className="min-w-28"
    />
  );
}

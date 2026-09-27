"use client";

import { useState, useTransition } from "react";
import { SettingsRow } from "@/components/ui/settings-list";
import { Switch } from "@/components/ui/switch";
import { setWeeklyRecap } from "@/lib/actions/push";

/** The Sunday recap push: the week's workouts, sets, bests and weakest point. */
export function WeeklyRecapRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <SettingsRow
      label="Sunday recap"
      hint="Your week in one notification: workouts, sets, new bests, and the weak point that's furthest behind."
      control={
        <Switch
          checked={on}
          onChange={(next) => {
            setOn(next);
            start(async () => {
              try {
                await setWeeklyRecap({ on: next });
              } catch {
                setOn(!next);
              }
            });
          }}
          label="Sunday recap"
        />
      }
    />
  );
}

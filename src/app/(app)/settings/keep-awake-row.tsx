"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsRow } from "@/components/ui/settings-list";
import { Switch } from "@/components/ui/switch";
import { canKeepAwake, keepAwakeOn, setKeepAwake } from "@/lib/keep-awake";

const noop = () => () => {};

/**
 * Keeps the screen on while a workout's open (useKeepAwake in the logger).
 * Per device; hidden where the browser can't do it.
 */
export function KeepAwakeRow() {
  const supported = useSyncExternalStore(noop, canKeepAwake, () => false);
  const [on, setOn] = useState(true);

  // The saved choice is per device, so it's read after mount.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOn(keepAwakeOn()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!supported) return null;
  return (
    <SettingsRow
      label="Keep screen on"
      hint="While a workout's open, so your phone doesn't lock between sets."
      control={
        <Switch
          checked={on}
          onChange={() => {
            setKeepAwake(!on);
            setOn(!on);
          }}
          label="Keep the screen on during workouts"
        />
      }
    />
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-list";
import { isNativeApp } from "@/lib/native";
import { healthSyncOn, nativePlugin, setHealthSync } from "@/lib/native-plugins";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * iPhone app only: the Apple Health switch. On, finished workouts and logged
 * bodyweight are saved to Health (see saveToHealth in the session logger and
 * the bodyweight manager). Nothing is ever read from Health. Renders nothing
 * on the website.
 */
export function AppleHealthSettings() {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  if (!inApp) return null;
  return (
    <SettingsGroup
      label="Apple Health"
      caption="Fatty only writes to Health, never reads from it. Manage access in the Health app under Sharing → Apps → Fatty."
    >
      <HealthRow />
    </SettingsGroup>
  );
}

function HealthRow() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // The saved choice is per device, so it's read after mount.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOn(healthSyncOn()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function toggle() {
    setMsg(null);
    if (on) {
      setHealthSync(false);
      setOn(false);
      return;
    }
    const plugin = nativePlugin();
    if (!plugin) return;
    setBusy(true);
    try {
      const { api } = await plugin;
      const status = await api.requestHealth();
      if (!status.available) {
        setMsg("Apple Health isn't available on this device.");
      } else if (status.workouts === "authorized" || status.bodyweight === "authorized") {
        setHealthSync(true);
        setOn(true);
      } else {
        setMsg("Fatty isn't allowed to save to Health yet. Turn it on in the Health app under Sharing → Apps → Fatty.");
      }
    } catch {
      setMsg("Couldn't reach Apple Health. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsRow
      label="Save workouts to Health"
      hint={msg ?? "Finished sessions as strength training, plus the bodyweight you log."}
      control={
        <button
          role="switch"
          aria-checked={on}
          aria-label="Save workouts to Apple Health"
          disabled={busy}
          onClick={toggle}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
            on ? "bg-accent" : "border border-border bg-surface-2",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white transition-transform",
              on ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      }
    />
  );
}

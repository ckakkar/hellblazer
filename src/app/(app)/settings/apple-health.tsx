"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-list";
import { isNativeApp } from "@/lib/native";
import { healthSyncOn, nativePlugin, setHealthSync, withNative } from "@/lib/native-plugins";
import { Switch } from "@/components/ui/switch";
import { recoveryOnHome, setRecoveryOnHome } from "@/components/native/recovery-card";

const noop = () => () => {};

/**
 * iPhone app only: the Apple Health switches. Saving: finished workouts
 * (with their effort) and logged bodyweight go to Health (saveToHealth in
 * the session logger, the bodyweight manager). Recovery: sleep, HRV and
 * resting heart rate are read for the card on Home, on the phone only.
 * Renders nothing on the website.
 */
export function AppleHealthSettings() {
  const inApp = useSyncExternalStore(noop, isNativeApp, () => false);
  if (!inApp) return null;
  return (
    <SettingsGroup
      label="Apple Health"
      caption="What Fatty reads from Health stays on this iPhone. Manage access in the Health app under Sharing → Apps → Fatty."
    >
      <HealthRow />
      <RecoveryRow />
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
      withNative((api) => api.setHealthSync({ on: false }));
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
        withNative((api) => api.setHealthSync({ on: true }));
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
      hint={msg ?? "Finished sessions as strength training, with your RPE as their effort, plus the bodyweight you log."}
      control={
        <Switch
          checked={on}
          onChange={() => void toggle()}
          label="Save workouts to Apple Health"
          disabled={busy}
        />
      }
    />
  );
}

/** Whether Recovery shows on Home (its "Not now" turns it off). */
function RecoveryRow() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOn(recoveryOnHome()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <SettingsRow
      label="Recovery on Home"
      hint="Sleep, heart rate variability and resting heart rate, read against your usual to say whether to push or go lighter."
      control={
        <Switch
          checked={on}
          onChange={() => {
            setRecoveryOnHome(!on);
            setOn(!on);
          }}
          label="Show Recovery on Home"
        />
      }
    />
  );
}

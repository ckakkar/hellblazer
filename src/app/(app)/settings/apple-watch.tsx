"use client";

import { useEffect, useState } from "react";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-list";
import { Switch } from "@/components/ui/switch";
import { linkWatch, unlinkWatch } from "@/lib/actions/watch";
import { nativePlugin, type WatchStatus } from "@/lib/native-plugins";
import { savedRestSeconds } from "@/lib/rest-timer";
import type { Unit } from "@/lib/units";

/**
 * iPhone app only, and only with a watch paired: the Apple Watch switches.
 * Connecting is automatic (WatchSync); this is where it's turned off, and
 * where the watch stops opening by itself when a workout starts here.
 */
export function AppleWatchSettings({
  userId,
  unit,
  accent,
}: {
  userId: string;
  unit: Unit;
  accent: string;
}) {
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const plugin = nativePlugin();
    if (!plugin) return;
    let cancelled = false;
    void plugin
      .then(({ api }) => api.watchStatus())
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.paired) return null;
  const on = !status.disabled;
  const connected = on && status.linkedUserId === userId;

  async function toggle(next: boolean) {
    const plugin = nativePlugin();
    if (!plugin || !status) return;
    setBusy(true);
    setMsg(null);
    try {
      const { api } = await plugin;
      if (next) {
        const { token } = await linkWatch();
        await api.watchSync({
          token,
          userId,
          unit,
          accent,
          restSeconds: savedRestSeconds(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else {
        const { token } = await api.watchUnlink({ disable: true });
        if (token) await unlinkWatch({ token });
      }
      setStatus(await api.watchStatus());
    } catch {
      setMsg("Couldn't reach your watch or the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setAutoOpen(next: boolean) {
    const plugin = nativePlugin();
    if (!plugin || !status) return;
    const { api } = await plugin;
    await api.setWatchAutoOpen({ on: next });
    setStatus({ ...status, autoOpen: next });
  }

  const hint =
    msg ??
    (!on
      ? "Off. Your watch shows nothing from this account."
      : !status.installed
        ? "To install Fatty on your watch, open the Watch app on this iPhone and find it under Available Apps."
        : connected
          ? "Connected. Start workouts, log sets and rest from your wrist."
          : "Connecting…");

  return (
    <SettingsGroup
      label="Apple Watch"
      caption="Your watch saves the workout to Apple Health with your heart rate. Needs watchOS 10 or later."
    >
      <SettingsRow
        label="Use Apple Watch"
        hint={hint}
        control={
          <Switch
            checked={on}
            onChange={(next) => void toggle(next)}
            label="Use Apple Watch"
            disabled={busy}
          />
        }
      />
      {on && (
        <SettingsRow
          label="Open on your watch"
          hint="Starting a workout here opens it on your watch."
          control={
            <Switch
              checked={status.autoOpen}
              onChange={(next) => void setAutoOpen(next)}
              label="Open workouts on Apple Watch"
            />
          }
        />
      )}
    </SettingsGroup>
  );
}

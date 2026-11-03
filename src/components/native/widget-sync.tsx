"use client";

import { useEffect } from "react";
import { getNativeSnapshot } from "@/lib/actions/native";
import { withNative } from "@/lib/native-plugins";
import { accountEpoch } from "@/lib/account-epoch";

/**
 * Hands the iOS widgets, Siri and Spotlight a fresh snapshot (the week, the
 * next day, your lifts and their trends) whenever the dashboard opens in the
 * app. Between visits, a silent push after each finished workout has the app
 * fetch one itself. Renders nothing, and does nothing on the website. A
 * snapshot that lands after this lifter signed out (or the page moved on)
 * is dropped, so it can't put their lifts back on the widgets.
 */
export function WidgetSync() {
  useEffect(() => {
    let live = true;
    const epoch = accountEpoch();
    withNative(async (api) => {
      const snapshot = await getNativeSnapshot();
      if (!live || accountEpoch() !== epoch) return;
      await api.updateWidget({ json: JSON.stringify({ ...snapshot, updatedAt: Date.now() }) });
    });
    return () => {
      live = false;
    };
  }, []);
  return null;
}

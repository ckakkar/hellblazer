"use client";

import { useEffect } from "react";
import { getNativeSnapshot } from "@/lib/actions/native";
import { withNative } from "@/lib/native-plugins";

/**
 * Hands the iOS widgets, Siri and Spotlight a fresh snapshot (the week, the
 * next day, your lifts and their trends) whenever the dashboard opens in the
 * app. Between visits, a silent push after each finished workout has the app
 * fetch one itself. Renders nothing, and does nothing on the website.
 */
export function WidgetSync() {
  useEffect(() => {
    withNative(async (api) => {
      const snapshot = await getNativeSnapshot();
      await api.updateWidget({ json: JSON.stringify({ ...snapshot, updatedAt: Date.now() }) });
    });
  }, []);
  return null;
}

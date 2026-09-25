"use client";

import { useEffect } from "react";
import { withNative, type WidgetSnapshot } from "@/lib/native-plugins";

/**
 * Hands the dashboard's numbers to the iOS Home Screen and Lock Screen
 * widgets, which can't reach the server themselves. Renders nothing, and
 * does nothing on the website.
 */
export function WidgetSync({ snapshot }: { snapshot: Omit<WidgetSnapshot, "updatedAt"> }) {
  const json = JSON.stringify(snapshot);
  useEffect(() => {
    withNative((api) =>
      api.updateWidget({ json: JSON.stringify({ ...JSON.parse(json), updatedAt: Date.now() }) }),
    );
  }, [json]);
  return null;
}

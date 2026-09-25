"use client";

import { useEffect } from "react";
import { getSiriSnapshot } from "@/lib/actions/native";
import { withNative, type WidgetSnapshot } from "@/lib/native-plugins";

/**
 * Hands the dashboard's numbers to the iOS Home Screen and Lock Screen
 * widgets, which can't reach the server themselves, along with what Siri
 * and Spotlight know (your workout days and best lifts). Renders nothing,
 * and does nothing on the website.
 */
export function WidgetSync({ snapshot }: { snapshot: Omit<WidgetSnapshot, "updatedAt" | keyof SiriFields> }) {
  const json = JSON.stringify(snapshot);
  useEffect(() => {
    withNative(async (api) => {
      const siri = await getSiriSnapshot().catch(() => null);
      await api.updateWidget({
        json: JSON.stringify({ ...JSON.parse(json), ...siri, updatedAt: Date.now() }),
      });
    });
  }, [json]);
  return null;
}

type SiriFields = Pick<WidgetSnapshot, "unit" | "workouts" | "lifts">;

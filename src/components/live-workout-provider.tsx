"use client";

import { useMemo, useState } from "react";
import {
  LiveSetsContext,
  LiveWorkoutContext,
  LoggedSetsContext,
  type LiveSetsReport,
  type LiveWorkout,
} from "@/lib/live-workout";

/**
 * Hands the layout's answer to "is a workout under way?" to the nav, with
 * the logger's count of its sets in place of the layout's while that's the
 * newer one (LiveSetsReport): made beside this same read of the layout.
 */
export function LiveWorkoutProvider({ value, children }: { value: LiveWorkout | null; children: React.ReactNode }) {
  const [report, setReport] = useState<LiveSetsReport | null>(null);
  const logged = report && report.base === value ? report : null;
  const live = useMemo(
    () => (value && logged?.id === value.id ? { ...value, workingSets: logged.sets } : value),
    [value, logged],
  );
  const reporter = useMemo(() => ({ base: value, report: setReport }), [value]);
  return (
    <LiveSetsContext value={reporter}>
      <LoggedSetsContext value={logged}>
        <LiveWorkoutContext value={live}>{children}</LiveWorkoutContext>
      </LoggedSetsContext>
    </LiveSetsContext>
  );
}

"use client";

import { createContext, useContext } from "react";

/** The lifter's most-trained lifts, most first (getUsualExerciseIds), for every picker on the page. */
const UsualLifts = createContext<string[]>([]);

export function UsualLiftsProvider({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  return <UsualLifts.Provider value={ids}>{children}</UsualLifts.Provider>;
}

export const useUsualLifts = () => useContext(UsualLifts);

"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useIPadApp } from "@/components/ipad-app";

/**
 * An empty state's way to fill it: start a workout. The iPad watches
 * workouts and never runs one (its /log goes Home), so there it says where
 * they're logged instead of offering a button that leads nowhere.
 */
export function StartWorkoutLink() {
  if (useIPadApp()) {
    return <p className="text-[13px] text-muted">Workouts are logged on your iPhone or Apple Watch.</p>;
  }
  return (
    <Link href="/log" className={buttonVariants({ variant: "secondary" })}>
      Start a workout
    </Link>
  );
}

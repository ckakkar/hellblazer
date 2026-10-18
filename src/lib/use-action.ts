"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { showNotice } from "@/lib/notice";

/**
 * `useTransition` for server actions. Uncaught, a failed action (nearly always
 * a dropped connection, say no signal in the gym) reaches the route's error
 * boundary and swaps the whole page for "Something didn't load", which is
 * wrong on both counts: the page did load, and retrying it doesn't retry the
 * action. Here the page stays and a notice says what didn't happen.
 * Redirects, an action's way of succeeding, still go through.
 *
 * `what` finishes "Couldn't …", e.g. "start the workout". `onFail` undoes
 * anything shown ahead of the server (an optimistic toggle).
 */
export function useAction(what: string) {
  const [pending, start] = useTransition();
  const run = (action: () => unknown, onFail?: () => void) =>
    start(async () => {
      try {
        await action();
      } catch (err) {
        unstable_rethrow(err);
        onFail?.();
        showNotice(
          navigator.onLine
            ? `Couldn't ${what}. Try again in a moment.`
            : `You're offline. Connect to ${what}.`,
        );
      }
    });
  return [pending, run] as const;
}

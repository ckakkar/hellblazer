/**
 * One short notice at a time, for an action that didn't go through (most
 * often a dropped connection). Shown by <NoticeToast /> in the root layout;
 * raised by `useAction` (`@/lib/use-action`). The logger keeps its own,
 * which also carries its PR callout.
 */
import { haptic } from "@/lib/haptics";

export type Notice = { id: number; text: string };

let current: Notice | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showNotice(text: string) {
  // In the app, the system's error buzz, as a failed action gets on iOS.
  haptic("error");
  current = { id: (current?.id ?? 0) + 1, text };
  clearTimeout(timer);
  timer = setTimeout(dismissNotice, 6000);
  emit();
}

export function dismissNotice() {
  clearTimeout(timer);
  if (current === null) return;
  current = null;
  emit();
}

export function subscribeNotice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getNotice = () => current;

"use client";

import { useState, useSyncExternalStore } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { usePresence } from "@/components/ui/use-modal";
import { dismissNotice, getNotice, subscribeNotice, type Notice } from "@/lib/notice";

/** Matches `.hb-toast`'s exit in globals.css. */
const EXIT_MS = 260;

/**
 * The notice from `showNotice`, at the top of the screen, over sheets too.
 * It drops in and, dismissed or timed out, goes back up the way it came
 * (the last one stays on screen while it leaves).
 */
export function NoticeToast() {
  const notice = useSyncExternalStore(subscribeNotice, getNotice, () => null);
  const [shown, setShown] = useState<Notice | null>(notice);
  if (notice && notice !== shown) setShown(notice);
  const mounted = usePresence(notice !== null, EXIT_MS);
  if (!mounted || !shown) return null;
  return (
    <Portal>
      {/* Stays live over an open sheet (use-modal makes the rest inert). */}
      <div
        data-hb-live
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex justify-center px-4"
      >
        <div
          key={shown.id}
          role="alert"
          data-state={notice ? "open" : "closed"}
          className="hb-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-elevated/95 px-4 py-3 shadow-raised backdrop-blur"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-text">{shown.text}</p>
          <button
            onClick={dismissNotice}
            aria-label="Dismiss"
            className="hb-hit -mr-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-text"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </Portal>
  );
}

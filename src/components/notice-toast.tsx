"use client";

import { useSyncExternalStore } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { dismissNotice, getNotice, subscribeNotice } from "@/lib/notice";

/** The notice from `showNotice`, at the top of the screen, over sheets too. */
export function NoticeToast() {
  const notice = useSyncExternalStore(subscribeNotice, getNotice, () => null);
  if (!notice) return null;
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] flex justify-center px-4">
        <div
          key={notice.id}
          role="alert"
          className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-[rgb(28_28_31/0.96)] px-4 py-3 shadow-raised backdrop-blur"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-text">{notice.text}</p>
          <button
            onClick={dismissNotice}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded p-1 text-muted transition-colors hover:text-text"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </Portal>
  );
}

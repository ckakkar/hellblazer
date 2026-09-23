"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { useModal, usePresence } from "@/components/ui/use-modal";
import { cn } from "@/lib/utils";

/** Matches the `.hb-sheet-panel` exit transition in globals.css. */
const EXIT_MS = 320;
/** Released past this far down, or flicked faster than this, it dismisses. */
const DISMISS_PX = 110;
const DISMISS_PX_PER_S = 650;
/** The sheet follows the finger at this ratio, so the pull feels weighted. */
const DRAG_RATIO = 0.7;

/**
 * Bottom sheet on phones, centred dialog from `sm` up. It rises from the edge
 * it lives on and can be dragged back down by its handle or header (not by the
 * body, so scrolling the content never fights the gesture). No springs: the
 * motion eases out and stops.
 *
 * The motion is CSS (`.hb-sheet-*` in globals.css), not an animation library:
 * this component sits in the app nav, so whatever it imports loads on every
 * route. `mounted` outlives `open` by the exit transition so the sheet can
 * leave the way it came.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = usePresence(open, EXIT_MS);
  useModal(open, panelRef, onClose);

  // Drag to dismiss, from the handle/header only. The finger drives the
  // transform directly (transition off); on release the CSS transition takes
  // it from wherever it is, either home or out.
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !panelRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    panelRef.current.setAttribute("data-dragging", "");
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = ((e.clientY - d.lastY) / dt) * 1000;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = Math.max(0, e.clientY - d.startY) * DRAG_RATIO;
    panel.style.transform = `translateY(${dy}px)`;
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - d.startY) * DRAG_RATIO;
    // A finger that stopped before lifting isn't flicking, whatever its
    // last move measured.
    const v = e.timeStamp - d.lastT < 100 ? d.v : 0;
    panel.removeAttribute("data-dragging");
    panel.style.transform = "";
    if (e.type === "pointerup" && (dy > DISMISS_PX || v > DISMISS_PX_PER_S)) onClose();
  }

  if (!mounted) return null;
  const state = open ? "open" : "closed";

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4",
          !open && "pointer-events-none",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open || undefined}
      >
        <div
          data-state={state}
          className="hb-sheet-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          data-state={state}
          tabIndex={-1}
          className="hb-sheet hb-sheet-panel relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)] focus:outline-none sm:rounded-[1.75rem] sm:pb-0"
        >
          <div
            className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-4">
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-text">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Close"
                className="-mr-1.5 flex size-9 items-center justify-center rounded-full bg-white/[0.07] text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/40"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <div className="px-5 pb-4 pt-3">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

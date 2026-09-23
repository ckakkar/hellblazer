"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { Portal } from "@/components/ui/portal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Bottom sheet on phones, centred dialog from `sm` up. It rises from the edge
 * it lives on and can be dragged back down by its handle or header (not by the
 * body, so scrolling the content never fights the gesture). No springs: the
 * motion eases out and stops.
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
  // Callers pass inline arrows for onClose, so its identity changes on every
  // render. Keep it in a ref so the scroll-lock effect below runs once per
  // open/close rather than re-firing (and losing the saved scroll position)
  // on every keystroke in the sheet.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    // Return focus where it came from, so closing the sheet puts the caret
    // back on the button that opened it.
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCloseRef.current();
      if (e.key !== "Tab") return;
      // Trap Tab inside the panel, or it walks out of an aria-modal dialog.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // Focus the panel itself rather than the first field, so opening a sheet
    // on mobile doesn't summon the keyboard over the content.
    panelRef.current?.focus({ preventScroll: true });

    // iOS Safari ignores `body { overflow: hidden }`; pin the body at its
    // offset instead and restore the scroll position on close.
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      Object.assign(style, prev);
      window.scrollTo(0, scrollY);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 110 || info.velocity.y > 650) onClose();
  }

  const duration = reduce ? 0 : 0.32;

  return (
    <AnimatePresence>
      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
            />
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              className="hb-sheet relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[1.75rem] pb-[env(safe-area-inset-bottom)] focus:outline-none sm:rounded-[1.75rem] sm:pb-0"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration, ease: EASE }}
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              dragTransition={{ bounceStiffness: 500, bounceDamping: 50 }}
              onDragEnd={onDragEnd}
            >
              <div
                className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => drag.start(e)}
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
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {children}
              </div>
              {footer && <div className="px-5 pb-4 pt-3">{footer}</div>}
            </motion.div>
          </div>
        </Portal>
      )}
    </AnimatePresence>
  );
}

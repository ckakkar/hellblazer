"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/portal";

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

  useEffect(() => {
    if (!open) return;

    // Return focus where it came from. Captured before we move focus, so
    // closing the sheet puts the caret back on the button that opened it
    // instead of dumping it at the top of the document.
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
      // Trap Tab inside the panel. Without this, tabbing walks straight out of
      // an aria-modal dialog into the page behind it.
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

    // Move focus into the dialog. The panel itself (tabIndex -1) rather than
    // the first field, so opening a sheet on mobile doesn't immediately summon
    // the keyboard and cover the content.
    panelRef.current?.focus({ preventScroll: true });

    // iOS Safari ignores `body { overflow: hidden }`, the page keeps scrolling
    // under the sheet. Pin the body at its current offset instead, then restore
    // the scroll position on close.
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
      // Restore focus only if it's still inside the (now unmounting) sheet;
      // if something else has claimed it since, leave it alone.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          className="hb-glass-strong relative z-10 flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border pb-[env(safe-area-inset-bottom)] focus:outline-none sm:rounded-2xl sm:pb-0"
        >
          {/* Grabber handle: bottom-sheet affordance on mobile */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-text">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-90"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
          {footer && <div className="border-t border-border p-4">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

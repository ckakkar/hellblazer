"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Never fires — we only want the server/client snapshot split. */
const noopSubscribe = () => () => {};

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
  // Portals need a DOM target, so render nothing until we're past hydration.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // Callers pass inline arrows for onClose, so its identity changes on every
  // render. Keep it in a ref so the scroll-lock effect below runs once per
  // open/close rather than re-firing (and losing the saved scroll position)
  // on every keystroke in the sheet.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);

    // iOS Safari ignores `body { overflow: hidden }` — the page keeps scrolling
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
    };
  }, [open]);

  if (!open || !hydrated) return null;

  // Portalled to <body> on purpose: `position: fixed` is resolved against the
  // nearest ancestor with a transform/filter/backdrop-filter, and the page
  // wrapper (.hb-page) animates transform with fill-mode `both`, which leaves
  // it acting as a containing block on WebKit. Rendered inline, the sheet would
  // anchor to the full page height and open far below the viewport.
  return createPortal(
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
      <div className="hb-glass-strong relative z-10 flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border pb-[env(safe-area-inset-bottom)] sm:rounded-2xl sm:pb-0">
        {/* Grabber handle — bottom-sheet affordance on mobile */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center text-muted transition-colors hover:text-text active:scale-90"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

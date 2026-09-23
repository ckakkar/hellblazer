"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Keeps an overlay mounted while it animates out. True as soon as `open`
 * turns true (adjusted during render, so the element exists when effects
 * run), and until `exitMs` after it turns false.
 */
export function usePresence(open: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMounted(true);
  }
  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, mounted, exitMs]);
  return mounted;
}

/**
 * Modal behaviour for an open overlay: Escape closes, Tab is trapped inside,
 * the page behind can't scroll (pinned the iOS way), and focus goes back to
 * whatever opened it on close. The overlay itself takes focus rather than
 * its first field, so opening one on a phone doesn't summon the keyboard.
 */
export function useModal(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // Callers pass inline arrows, so onClose changes identity every render.
  // Held in a ref so the effect runs once per open/close instead of
  // re-firing (and losing the saved scroll position) on every keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
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
  }, [open, panelRef]);
}

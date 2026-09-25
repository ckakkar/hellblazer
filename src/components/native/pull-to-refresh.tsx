"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";
import { haptic } from "@/lib/haptics";

/** Finger travel, in px, that arms a refresh (the page rubber-bands under it). */
const THRESHOLD = 120;
/** A refresh shows for at least this long, so it reads as having happened. */
const MIN_SPIN_MS = 600;

/** The logger is mid-workout; a stray pull there shouldn't reload anything. */
const excluded = (pathname: string) => pathname.startsWith("/log/");

/**
 * iOS app only: pull down at the top of a page to refresh it, with the
 * system's spinner. It follows the finger rather than scroll events, so it
 * doesn't depend on how WebKit reports rubber-banding, and it triggers as the
 * pull crosses the threshold, as UIRefreshControl does, with the same knock.
 * While it refreshes the page sits lower (.hb-ptr on <html>), like a table
 * view holding its content under the spinner.
 */
export function PullToRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const spinStart = useRef(0);
  const refreshing = spinning || pending;

  useEffect(() => {
    if (!isNativeApp() || excluded(pathname)) return;
    let startY: number | null = null;
    let fired = false;

    const onStart = (e: TouchEvent) => {
      // Not with a sheet or menu open (the page behind is pinned at 0), not
      // mid-scroll, and not twice at once.
      const blocked =
        window.scrollY > 0 ||
        document.body.style.position === "fixed" ||
        document.querySelector('[aria-modal="true"]') !== null ||
        e.touches.length > 1;
      startY = blocked ? null : e.touches[0].clientY;
      fired = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null || fired) return;
      if (window.scrollY > 0) {
        startY = null;
        setProgress(0);
        return;
      }
      const p = Math.max(0, Math.min(1, (e.touches[0].clientY - startY) / THRESHOLD));
      setProgress(p);
      if (p >= 1) {
        fired = true;
        haptic("tap");
        spinStart.current = Date.now();
        setSpinning(true);
        startTransition(() => router.refresh());
      }
    };
    const onEnd = () => {
      startY = null;
      if (!fired) setProgress(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pathname, router]);

  // Done once the refresh has landed and the minimum spin has passed.
  useEffect(() => {
    if (!spinning || pending) return;
    const id = window.setTimeout(
      () => {
        setSpinning(false);
        setProgress(0);
      },
      Math.max(0, MIN_SPIN_MS - (Date.now() - spinStart.current)),
    );
    return () => window.clearTimeout(id);
  }, [spinning, pending]);

  useEffect(() => {
    const root = document.documentElement;
    if (refreshing) root.classList.add("hb-ptr");
    else root.classList.remove("hb-ptr");
    return () => root.classList.remove("hb-ptr");
  }, [refreshing]);

  if (progress === 0 && !refreshing) return null;
  return (
    <div
      aria-live="polite"
      aria-label={refreshing ? "Refreshing" : undefined}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-20 flex justify-center md:hidden"
    >
      <ActivityIndicator progress={refreshing ? 1 : progress} spinning={refreshing} />
    </div>
  );
}

/**
 * UIActivityIndicatorView: eight spokes. Pulling draws them in one by one;
 * refreshing turns them, stepping like the system's.
 */
function ActivityIndicator({ progress, spinning }: { progress: number; spinning: boolean }) {
  const shown = Math.ceil(progress * 8);
  return (
    <svg
      viewBox="0 0 28 28"
      className={spinning ? "hb-spokes size-7 text-text" : "size-7 text-text"}
      aria-hidden
    >
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="12.75"
          y="2"
          width="2.5"
          height="7"
          rx="1.25"
          fill="currentColor"
          transform={`rotate(${i * 45} 14 14)`}
          opacity={spinning ? 1 - ((8 - i) % 8) * 0.1 : i < shown ? 0.85 : 0}
        />
      ))}
    </svg>
  );
}

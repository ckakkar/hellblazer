"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { withNative } from "@/lib/native-plugins";
import {
  clampRestDuration,
  DEFAULT_REST_SECONDS,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
} from "@/lib/rest-timer";

const STORAGE_KEY = "hell-blazer:rest-seconds";

/**
 * In the iOS app the countdown also runs natively: a Live Activity on the Lock
 * Screen and in the Dynamic Island, and a "Rest's up" alert when it ends,
 * since the page's own timer stops while the phone is locked. `label` names
 * what the rest comes before.
 */
export function RestTimer({ label }: { label?: string }) {
  const [duration, setDuration] = useState(DEFAULT_REST_SECONDS);
  const [remaining, setRemaining] = useState(DEFAULT_REST_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      if (
        Number.isFinite(saved) &&
        saved >= MIN_REST_SECONDS &&
        saved <= MAX_REST_SECONDS
      ) {
        setDuration(saved);
        setRemaining(saved);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!running || endAt.current === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((endAt.current! - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        setFinished(true);
        endAt.current = null;
        haptic("rest-done");
        withNative((api) => api.stopRest());
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Leaving the session mid-rest ends the native countdown with it.
  useEffect(
    () => () => {
      if (endAt.current !== null) withNative((api) => api.stopRest());
    },
    [],
  );

  function toggle() {
    setFinished(false);
    if (running) {
      setRunning(false);
      endAt.current = null;
      withNative((api) => api.stopRest());
      return;
    }
    if (remaining === 0) setRemaining(duration);
    const endsAt = Date.now() + (remaining || duration) * 1000;
    endAt.current = endsAt;
    setRunning(true);
    withNative((api) => api.startRest({ endsAt, total: duration, label }));
  }

  function adjust(delta: number) {
    if (running) withNative((api) => api.stopRest());
    const next = clampRestDuration(duration + delta);
    setDuration(next);
    setRemaining(next);
    setRunning(false);
    setFinished(false);
    endAt.current = null;
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }

  function reset() {
    if (running) withNative((api) => api.stopRest());
    setRemaining(duration);
    setRunning(false);
    setFinished(false);
    endAt.current = null;
  }

  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

  return (
    <section
      aria-label="Rest timer"
      className={cn(
        "relative mt-3 overflow-hidden rounded-2xl px-4 py-3",
        finished ? "bg-accent/[0.12]" : "bg-surface",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-white/[0.04] transition-[width] duration-300"
        style={{ width: `${progress}%` }}
      />
      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <TimerReset className={cn("size-3.5", finished && "text-accent")} />
            {finished ? "Rest's over" : running ? "Resting" : "Rest"}
          </div>
          <div
            className={cn(
              "font-display mt-1 text-[1.75rem] leading-none",
              finished ? "text-accent" : "text-text",
            )}
            aria-live="polite"
          >
            {finished ? "Go" : formatRestClock(remaining)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjust(-15)}
            className="tnum flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-[13px] text-muted transition-colors hover:text-text active:bg-white/[0.1]"
            aria-label="Reduce rest duration by 15 seconds"
          >
            −15
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex size-11 items-center justify-center rounded-full bg-accent text-black active:opacity-80"
            aria-label={running ? "Pause rest timer" : "Start rest timer"}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => adjust(15)}
            className="tnum flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-[13px] text-muted transition-colors hover:text-text active:bg-white/[0.1]"
            aria-label="Increase rest duration by 15 seconds"
          >
            +15
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
            aria-label="Reset rest timer"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clampRestDuration,
  DEFAULT_REST_SECONDS,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
} from "@/lib/rest-timer";

const STORAGE_KEY = "hell-blazer:rest-seconds";

export function RestTimer() {
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
        navigator.vibrate?.([120, 70, 180]);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  function toggle() {
    setFinished(false);
    if (running) {
      setRunning(false);
      endAt.current = null;
      return;
    }
    if (remaining === 0) setRemaining(duration);
    endAt.current = Date.now() + (remaining || duration) * 1000;
    setRunning(true);
  }

  function adjust(delta: number) {
    const next = clampRestDuration(duration + delta);
    setDuration(next);
    setRemaining(next);
    setRunning(false);
    setFinished(false);
    endAt.current = null;
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }

  function reset() {
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
        "relative mt-3 overflow-hidden border-y px-0.5 py-2.5",
        finished ? "border-accent bg-accent/[0.08]" : "border-border",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-accent/[0.08] transition-[width] duration-300"
        style={{ width: `${progress}%` }}
      />
      <div className="relative flex items-center gap-3">
        <TimerReset className={cn("size-4", finished ? "text-accent" : "text-muted")} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            {finished ? "Back in" : running ? "Between rounds" : "Rest clock"}
          </div>
          <div
            className={cn(
              "mt-0.5 font-impact text-3xl leading-none tabular-nums",
              finished ? "text-accent" : "text-text",
            )}
            aria-live="polite"
          >
            {finished ? "TIME" : formatRestClock(remaining)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjust(-15)}
            className="min-h-10 min-w-10 border border-border px-2 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-text"
            aria-label="Reduce rest duration by 15 seconds"
          >
            −15
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex size-11 items-center justify-center bg-accent text-bg transition-transform active:scale-95"
            aria-label={running ? "Pause rest timer" : "Start rest timer"}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => adjust(15)}
            className="min-h-10 min-w-10 border border-border px-2 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-text"
            aria-label="Increase rest duration by 15 seconds"
          >
            +15
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex size-10 items-center justify-center text-muted transition-colors hover:text-text"
            aria-label="Reset rest timer"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

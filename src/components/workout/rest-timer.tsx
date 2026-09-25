"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { withNative } from "@/lib/native-plugins";
import {
  clampRestDuration,
  DEFAULT_REST_SECONDS,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
} from "@/lib/rest-timer";

const DURATION_KEY = "hell-blazer:rest-seconds";
const AUTO_KEY = "hell-blazer:rest-auto";
/** The rest in progress, so a reload or a trip to another tab keeps it. */
const RUNNING_KEY = "hell-blazer:rest-running";

type Stored = { sessionId: string; endsAt: number; total: number };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the timer still works, it just won't survive a reload.
  }
}

export type RestTimerControls = {
  /** The default rest, in seconds. */
  duration: number;
  /** When the running rest ends (epoch ms); null when not running. */
  endsAt: number | null;
  /** Seconds left on a paused rest; null unless paused. */
  pausedRemaining: number | null;
  /** The current rest's full length in seconds, for progress. */
  total: number;
  /** The last rest ran out and nothing has started since. */
  finished: boolean;
  /** Start a rest by itself each time a set is logged. */
  auto: boolean;
  /** A fresh rest of the default length, from now. */
  start: () => void;
  /** Pause, resume, or start. */
  toggle: () => void;
  /** Running or paused: moves this rest. Idle: changes the default. */
  adjust: (deltaSeconds: number) => void;
  /** Stop and reset. */
  skip: () => void;
  setAuto: (on: boolean) => void;
};

/**
 * The logger's rest timer. It lives here rather than in a component so the
 * header card and the bar inside the exercise sheet share one countdown.
 *
 * Only events change this state (start, pause, a rest running out); the
 * displays tick on their own with useRestRemaining, so the logger doesn't
 * re-render four times a second. In the iOS app a rest also schedules a
 * "Rest's up" alert, since the page's timers stop while the phone is locked;
 * the Live Activity countdown comes from the logger's workout state.
 */
export function useRestTimer({ sessionId, label }: { sessionId: string; label?: string }): RestTimerControls {
  const [duration, setDuration] = useState(DEFAULT_REST_SECONDS);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(DEFAULT_REST_SECONDS);
  const [finished, setFinished] = useState(false);
  const [auto, setAutoState] = useState(true);
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  // Saved settings and a rest still running from before a reload.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = Number(read(DURATION_KEY));
      if (Number.isFinite(saved) && saved >= MIN_REST_SECONDS && saved <= MAX_REST_SECONDS) {
        setDuration(saved);
        setTotal(saved);
      }
      setAutoState(read(AUTO_KEY) !== "off");
      try {
        const running = JSON.parse(read(RUNNING_KEY) ?? "null") as Stored | null;
        if (running?.sessionId === sessionId && running.endsAt > Date.now() + 500) {
          setEndsAt(running.endsAt);
          setTotal(running.total);
        }
      } catch {
        write(RUNNING_KEY, null);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sessionId]);

  const run = useCallback(
    (end: number, length: number) => {
      setEndsAt(end);
      setTotal(length);
      setPausedRemaining(null);
      setFinished(false);
      write(RUNNING_KEY, JSON.stringify({ sessionId, endsAt: end, total: length } satisfies Stored));
      withNative((api) => api.scheduleRestAlert({ endsAt: end, label: labelRef.current }));
    },
    [sessionId],
  );

  const halt = useCallback(() => {
    setEndsAt(null);
    write(RUNNING_KEY, null);
    withNative((api) => api.cancelRestAlert());
  }, []);

  // The rest running out. A timeout rather than a tick: nothing here needs
  // to re-render until then. Timers stop while the app is in the background,
  // so a rest that ran out long ago ends quietly on return, no buzz.
  useEffect(() => {
    if (endsAt === null) return;
    const id = window.setTimeout(() => {
      const late = Date.now() - endsAt > 3000;
      halt();
      setFinished(true);
      if (!late) haptic("rest-done");
    }, Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [endsAt, halt]);

  const start = useCallback(() => {
    run(Date.now() + duration * 1000, duration);
    haptic("tap");
  }, [duration, run]);

  const toggle = useCallback(() => {
    if (endsAt !== null) {
      setPausedRemaining(Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)));
      halt();
      return;
    }
    if (pausedRemaining !== null) {
      run(Date.now() + pausedRemaining * 1000, total);
      return;
    }
    start();
  }, [endsAt, pausedRemaining, total, halt, run, start]);

  const adjust = useCallback(
    (delta: number) => {
      haptic("tick");
      if (endsAt !== null) {
        const next = Math.max(Date.now() + 1000, endsAt + delta * 1000);
        const left = Math.ceil((next - Date.now()) / 1000);
        run(next, Math.max(left, total + Math.max(0, delta)));
        return;
      }
      if (pausedRemaining !== null) {
        const left = Math.min(MAX_REST_SECONDS, Math.max(1, pausedRemaining + delta));
        setPausedRemaining(left);
        setTotal((t) => Math.max(t, left));
        return;
      }
      const next = clampRestDuration(duration + delta);
      setDuration(next);
      setTotal(next);
      setFinished(false);
      write(DURATION_KEY, String(next));
    },
    [endsAt, pausedRemaining, duration, total, run],
  );

  const skip = useCallback(() => {
    halt();
    setPausedRemaining(null);
    setFinished(false);
    setTotal(duration);
  }, [duration, halt]);

  const setAuto = useCallback((on: boolean) => {
    setAutoState(on);
    write(AUTO_KEY, on ? "on" : "off");
  }, []);

  return { duration, endsAt, pausedRemaining, total, finished, auto, start, toggle, adjust, skip, setAuto };
}

/** Seconds left, ticking while a rest runs. Only the display re-renders. */
function useRestRemaining(t: RestTimerControls): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (t.endsAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [t.endsAt]);
  if (t.endsAt !== null) {
    // Capped at the rest's length: on the frame before the first tick `now`
    // is stale, and a fresh rest should read as full, not longer.
    return Math.min(t.total, Math.max(0, Math.ceil((t.endsAt - now) / 1000)));
  }
  if (t.pausedRemaining !== null) return t.pausedRemaining;
  return t.finished ? 0 : t.duration;
}

const roundButton =
  "tnum flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-[13px] text-muted transition-colors hover:text-text active:bg-white/[0.1]";

/** The full rest timer, under the logger's live readout. */
export function RestTimerCard({ timer }: { timer: RestTimerControls }) {
  const remaining = useRestRemaining(timer);
  const running = timer.endsAt !== null;
  const { finished } = timer;
  const progress = timer.total > 0 ? ((timer.total - remaining) / timer.total) * 100 : 0;

  return (
    <section
      aria-label="Rest timer"
      className={cn(
        "relative mt-3 overflow-hidden rounded-2xl",
        finished ? "bg-accent/[0.12]" : "bg-surface",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-white/[0.04] transition-[width] duration-300"
        style={{ width: `${running || timer.pausedRemaining !== null ? progress : 0}%` }}
      />
      <div className="relative flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <TimerReset className={cn("size-3.5", finished && "text-accent")} />
            {finished
              ? "Rest's over"
              : running
                ? "Resting"
                : timer.pausedRemaining !== null
                  ? "Paused"
                  : "Rest"}
          </div>
          <div
            className={cn("font-display mt-1 text-[1.75rem] leading-none", finished ? "text-accent" : "text-text")}
            aria-live="polite"
          >
            {finished ? "Go" : formatRestClock(remaining)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => timer.adjust(-15)}
            className={roundButton}
            aria-label={running ? "Take 15 seconds off this rest" : "Shorten rest by 15 seconds"}
          >
            −15
          </button>
          <button
            type="button"
            onClick={timer.toggle}
            className="flex size-11 items-center justify-center rounded-full bg-accent text-black active:opacity-80"
            aria-label={running ? "Pause rest timer" : "Start rest timer"}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => timer.adjust(15)}
            className={roundButton}
            aria-label={running ? "Add 15 seconds to this rest" : "Lengthen rest by 15 seconds"}
          >
            +15
          </button>
          <button
            type="button"
            onClick={timer.skip}
            className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
            aria-label="Reset rest timer"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      <label className="relative flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5 text-[13px] text-muted">
        Start after each set
        <Switch checked={timer.auto} onChange={timer.setAuto} label="Start the rest timer after each set" />
      </label>
    </section>
  );
}

/**
 * The rest timer inside the exercise sheet, where sets are logged: one line
 * above the sheet's main button, so the countdown is in view mid-set.
 */
export function RestTimerBar({ timer }: { timer: RestTimerControls }) {
  const remaining = useRestRemaining(timer);
  const running = timer.endsAt !== null;
  const paused = timer.pausedRemaining !== null;
  const { finished } = timer;
  const progress = timer.total > 0 ? ((timer.total - remaining) / timer.total) * 100 : 0;
  const pill =
    "tnum flex h-9 min-w-9 items-center justify-center rounded-full bg-white/[0.07] px-2.5 text-[13px] text-text active:bg-white/[0.12]";

  return (
    <div
      aria-label="Rest timer"
      className={cn(
        "relative mb-3 overflow-hidden rounded-2xl",
        finished ? "bg-accent/[0.12]" : "bg-white/[0.05]",
      )}
    >
      <div className="flex h-12 items-center gap-2 pl-3.5 pr-1.5">
        <TimerReset className={cn("size-4 shrink-0", finished || running ? "text-accent" : "text-muted")} />
        <span className="min-w-0 flex-1 truncate text-[14px] text-muted" aria-live="polite">
          {finished ? (
            <span className="font-medium text-accent">Rest&apos;s over. Go</span>
          ) : (
            <>
              {running ? "Resting " : paused ? "Paused " : "Rest "}
              <span className="font-display text-[17px] text-text">{formatRestClock(remaining)}</span>
            </>
          )}
        </span>
        {running || paused ? (
          <>
            <button type="button" onClick={() => timer.adjust(-15)} className={pill} aria-label="Take 15 seconds off this rest">
              −15
            </button>
            <button type="button" onClick={() => timer.adjust(15)} className={pill} aria-label="Add 15 seconds to this rest">
              +15
            </button>
            <button type="button" onClick={timer.toggle} className={pill} aria-label={running ? "Pause rest" : "Resume rest"}>
              {running ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
            </button>
            <button type="button" onClick={timer.skip} className={pill}>
              Skip
            </button>
          </>
        ) : (
          <button type="button" onClick={timer.start} className={pill}>
            <Play className="mr-1 size-3 fill-current" />
            {finished ? "Again" : "Start"}
          </button>
        )}
      </div>
      {(running || paused) && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 bg-accent/70 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
}

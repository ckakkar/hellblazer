"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { isNativeApp } from "@/lib/native";
import { onNative, withNative, type RestCommand } from "@/lib/native-plugins";
import {
  clampRestDuration,
  DEFAULT_REST_SECONDS,
  formatRestClock,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  REST_AUTO_KEY,
  REST_SECONDS_KEY,
} from "@/lib/rest-timer";

const DURATION_KEY = REST_SECONDS_KEY;
const AUTO_KEY = REST_AUTO_KEY;
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
  /** Starts a rest: `seconds` for this exercise's own length, else the default. */
  start: (seconds?: number) => void;
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
    (end: number, length: number, alert = true) => {
      setEndsAt(end);
      setTotal(length);
      setPausedRemaining(null);
      setFinished(false);
      write(RUNNING_KEY, JSON.stringify({ sessionId, endsAt: end, total: length } satisfies Stored));
      withNative((api) =>
        alert
          ? api.scheduleRestAlert({ endsAt: end, label: labelRef.current, sessionId })
          : api.cancelRestAlert(),
      );
    },
    [sessionId],
  );

  const halt = useCallback(() => {
    setEndsAt(null);
    write(RUNNING_KEY, null);
    withNative((api) => api.cancelRestAlert());
  }, []);

  // A rest the lifter changed here goes to the watch too, so the wrist
  // counts down the same one. Not a rest that came from the watch (or the
  // Lock Screen, whose own change already went there): applyCommand below
  // doesn't call this, so nothing echoes.
  const share = useCallback(
    (end: number | null, length: number) => {
      withNative((api) => api.syncRest({ sessionId, endsAt: end ?? undefined, total: length }));
    },
    [sessionId],
  );

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

  const start = useCallback(
    (seconds?: number) => {
      const length = seconds ?? duration;
      const end = Date.now() + length * 1000;
      run(end, length);
      share(end, length);
      haptic("tap");
    },
    [duration, run, share],
  );

  const toggle = useCallback(() => {
    if (endsAt !== null) {
      setPausedRemaining(Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)));
      halt();
      // The watch has no pause: its rest stops until this one resumes.
      share(null, total);
      return;
    }
    if (pausedRemaining !== null) {
      const end = Date.now() + pausedRemaining * 1000;
      run(end, total);
      share(end, total);
      return;
    }
    start();
  }, [endsAt, pausedRemaining, total, halt, run, share, start]);

  const adjust = useCallback(
    (delta: number) => {
      haptic("tick");
      if (endsAt !== null) {
        const next = Math.max(Date.now() + 1000, endsAt + delta * 1000);
        const left = Math.ceil((next - Date.now()) / 1000);
        const length = Math.max(left, total + Math.max(0, delta));
        run(next, length);
        share(next, length);
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
      // A set said to Siri while this page sleeps starts the same rest.
      withNative((api) => api.setRestDefaults({ seconds: next, auto }));
    },
    [endsAt, pausedRemaining, duration, total, auto, run, share],
  );

  const skip = useCallback(() => {
    if (endsAt !== null) share(null, 0);
    halt();
    setPausedRemaining(null);
    setFinished(false);
    setTotal(duration);
  }, [duration, endsAt, halt, share]);

  // A rest changed outside the page: the Live Activity's +30s and Skip, the
  // alert's +30s, a set logged on the watch. The app keeps the latest one
  // until taken; it says when there's one, and the page also checks on its
  // way back to the screen, in case it was asleep when that happened.
  const applyCommand = useCallback(
    (command: RestCommand) => {
      if (command.endsAt === null || command.endsAt <= Date.now() + 500) {
        setEndsAt(null);
        setPausedRemaining(null);
        setFinished(false);
        write(RUNNING_KEY, null);
        return;
      }
      run(command.endsAt, command.total, command.alert);
    },
    [run],
  );
  const commandRef = useRef(applyCommand);
  useEffect(() => {
    commandRef.current = applyCommand;
  }, [applyCommand]);
  useEffect(() => {
    if (!isNativeApp()) return;
    const take = () =>
      withNative(async (api) => {
        const command = await api.takeRestCommand({ sessionId });
        if (command.sessionId === sessionId) commandRef.current(command as RestCommand);
      });
    const onVisible = () => {
      if (document.visibilityState === "visible") take();
    };
    take();
    document.addEventListener("visibilitychange", onVisible);
    const off = onNative("restCommand", take);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      off();
    };
  }, [sessionId]);

  const setAuto = useCallback(
    (on: boolean) => {
      setAutoState(on);
      write(AUTO_KEY, on ? "on" : "off");
      withNative((api) => api.setRestDefaults({ seconds: duration, auto: on }));
    },
    [duration],
  );

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
  "tnum flex size-10 items-center justify-center rounded-full bg-text/[0.06] text-[13px] text-muted transition-colors hover:text-text active:bg-text/[0.1]";

/** Ticks on the rest timer's scale; every fifth is long. */
const TICKS = 40;

/**
 * The full rest timer, under the exercise you're on. Built as an instrument
 * rather than a card: an outlined face, the clock big, and a tick scale that
 * fills as the rest runs, so its state reads at a glance from the bench.
 */
export function RestTimerCard({ timer }: { timer: RestTimerControls }) {
  const remaining = useRestRemaining(timer);
  const running = timer.endsAt !== null;
  const { finished } = timer;
  const started = running || timer.pausedRemaining !== null;
  const lit = finished ? TICKS : started && timer.total > 0 ? Math.round(((timer.total - remaining) / timer.total) * TICKS) : 0;

  return (
    <section
      aria-label="Rest timer"
      className={cn(
        "rounded-3xl px-4 pb-3 pt-3.5 ring-1 ring-inset transition-colors duration-200",
        finished ? "bg-accent/[0.08] ring-accent/40" : "ring-text/[0.12]",
      )}
    >
      <div className="flex items-end gap-2 min-[360px]:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <TimerReset className={cn("size-3.5", finished && "text-accent")} />
            {finished ? "Rest's over" : running ? "Resting" : timer.pausedRemaining !== null ? "Paused" : "Rest"}
          </div>
          <div
            className={cn(
              // Shrinks a little on a 320pt phone, where the controls need the row.
              "font-display mt-1.5 text-[clamp(2rem,10vw,2.625rem)] leading-none",
              finished ? "text-accent" : running ? "text-text" : "text-text/70",
            )}
            aria-live="polite"
          >
            {finished ? "Go" : formatRestClock(remaining)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pb-0.5 min-[360px]:gap-1.5">
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
            className="-mr-1.5 flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
            aria-label="Reset rest timer"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
      {/* The scale: one tick per fortieth of the rest, lit as it runs. */}
      <div aria-hidden className="mt-3.5 flex h-3 items-end justify-between">
        {Array.from({ length: TICKS + 1 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "w-px transition-colors duration-200",
              i % 5 === 0 ? "h-3" : "h-1.5",
              i < lit || (finished && i <= lit)
                ? finished
                  ? "bg-accent"
                  : "bg-text"
                : "bg-text/[0.18]",
            )}
          />
        ))}
      </div>
      <label className="mt-3 flex items-center justify-between gap-3 border-t border-text/[0.08] pt-2.5 text-[13px] text-muted">
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
    "tnum flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-text/[0.07] px-2 text-[13px] text-text active:bg-text/[0.12] min-[360px]:px-2.5";

  return (
    <div
      aria-label="Rest timer"
      className={cn(
        "relative mb-3 overflow-hidden rounded-2xl",
        finished ? "bg-accent/[0.12]" : "bg-text/[0.05]",
      )}
    >
      <div className="flex h-12 items-center gap-1.5 pl-3.5 pr-1.5 min-[360px]:gap-2">
        <TimerReset className={cn("size-4 shrink-0", finished || running ? "text-accent" : "text-muted")} />
        <span className="flex min-w-0 flex-1 items-baseline gap-1 text-[14px] text-muted" aria-live="polite">
          {finished ? (
            <span className="truncate font-medium text-accent-ink">Rest&apos;s over. Go</span>
          ) : (
            <>
              {/* The word gives way before the clock does: on a 320pt phone
                  the controls leave room for the countdown alone. */}
              <span className="truncate max-[359px]:sr-only">
                {running ? "Resting" : paused ? "Paused" : "Rest"}
              </span>
              <span className="font-display shrink-0 text-[17px] text-text">{formatRestClock(remaining)}</span>
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
          <button type="button" onClick={() => timer.start()} className={pill}>
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

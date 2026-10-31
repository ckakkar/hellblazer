"use client";

import { useDeviceName } from "@/lib/device";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowDownRight, ArrowRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/page-header";
import { isNativeApp } from "@/lib/native";
import { nativePlugin } from "@/lib/native-plugins";
import { assessRecovery, formatSleep, type Reading, type Recovery, type Tone } from "@/lib/recovery";
import type { TrainingLoad } from "@/lib/training-load";
import { cn, fitFigure } from "@/lib/utils";

const KEY = "hell-blazer:recovery";
/** Health is read again this often while Home's open, as well as on coming back to it. */
const REFRESH_MS = 60 * 60 * 1000;

/** Whether Recovery shows on Home, per device. On unless turned off. */
export function recoveryOnHome(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setRecoveryOnHome(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "off");
  } catch {
    // Storage blocked: it stays on.
  }
}

export type RecoveryView =
  | { kind: "hidden" }
  | { kind: "ask" }
  /** Just connected, but Health has nothing yet (no watch worn to bed). */
  | { kind: "empty" }
  | { kind: "ready"; recovery: Recovery; readAt: number };

/**
 * iPhone and iPad app only: whether today's a day to push, from Apple
 * Health's sleep, breathing, heart rate variability and heart rates, and
 * Fatty's own log of the training (src/lib/recovery.ts). Health is read on
 * the phone and never sent anywhere; the training side is handed to the app
 * so the widget and the watch weigh it too. Read on opening, on coming back
 * to the app, and every hour while it's open. Until Health has been asked,
 * it offers to connect; "Not now" hides it (Settings brings it back).
 * Renders nothing on the website, or in an app build without the readings.
 */
export function RecoveryCard({ load = null }: { load?: TrainingLoad | null }) {
  const [view, setView] = useState<RecoveryView>({ kind: "hidden" });
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const read = useCallback(async (justAsked = false) => {
    const plugin = nativePlugin();
    if (!plugin || !recoveryOnHome()) return;
    try {
      const { api } = await plugin;
      const status = await api.recoveryStatus();
      if (!status.available) return setView({ kind: "hidden" });
      if (status.shouldRequest) return setView({ kind: "ask" });
      const { days, workouts } = await api.recoveryData();
      const recovery = assessRecovery(days, { load: loadRef.current, workouts });
      setView(
        recovery
          ? { kind: "ready", recovery, readAt: Date.now() }
          : justAsked
            ? { kind: "empty" }
            : { kind: "hidden" },
      );
    } catch {
      // An app build from before Recovery: nothing to show.
      setView({ kind: "hidden" });
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const frame = window.requestAnimationFrame(() => void read());
    // Back in front (the phone unlocked, the app reopened): fresh numbers.
    const onVisible = () => {
      if (document.visibilityState === "visible") void read();
    };
    // Open for a long while (Home on the bench): the hour's readings.
    const hourly = window.setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(hourly);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [read]);

  // The training side, to the app: its background refresh (the widget, the
  // watch) weighs it with the hour's Health readings. Builds before 2.9
  // don't have it.
  useEffect(() => {
    if (!load || !isNativeApp()) return;
    const plugin = nativePlugin();
    if (!plugin) return;
    void plugin
      .then(({ api }) =>
        api.setTrainingLoad({
          lastHeavyAt: load.lastHeavy?.at ?? null,
          lastHeavyTitle: load.lastHeavy?.title ?? null,
          lastHeavySets: load.lastHeavy?.sets ?? null,
          recentSets: load.recentSets,
          usualSets: load.usualSets,
          streakDays: load.streakDays,
          at: Date.now(),
        }),
      )
      .catch(() => undefined);
  }, [load]);

  async function connect() {
    const plugin = nativePlugin();
    if (!plugin) return;
    try {
      const { api } = await plugin;
      // Only Recovery's readings; a build before 2.8 has just the one sheet.
      await api.requestRecovery().catch(() => api.requestHealth());
    } catch {
      // The sheet failed to show; the card stays as it was.
    }
    await read(true);
  }

  function hide() {
    setRecoveryOnHome(false);
    setView({ kind: "hidden" });
  }

  return <RecoveryPanel view={view} onConnect={() => void connect()} onHide={hide} />;
}

/** The card itself, for whatever state RecoveryCard is in. */
export function RecoveryPanel({
  view,
  onConnect,
  onHide,
}: {
  view: RecoveryView;
  onConnect: () => void;
  onHide: () => void;
}) {
  const device = useDeviceName();
  if (view.kind === "hidden") return null;

  if (view.kind === "ask" || view.kind === "empty") {
    return (
      <section>
        <SectionLabel>Recovery</SectionLabel>
        <div className="rounded-2xl bg-surface p-5">
          <p className="text-[17px] font-semibold tracking-[-0.01em] text-text">
            {view.kind === "ask" ? "Know when to push" : "Nothing to read yet"}
          </p>
          <p className="mt-1 text-[15px] leading-6 text-muted">
            {view.kind === "ask"
              ? `Fatty can read your sleep, breathing, heart rate variability and heart rates from Apple Health, weigh them with your training, and tell you whether to go hard or go lighter. It stays on this ${device}.`
              : "Health has no sleep or heart readings for Fatty. Wear your Apple Watch to bed, or allow Fatty in the Health app under Sharing → Apps → Fatty, and Recovery shows up here."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {view.kind === "ask" && (
              <Button variant="primary" onClick={onConnect}>
                Connect Apple Health
              </Button>
            )}
            <Button variant="ghost" onClick={onHide}>
              {view.kind === "ask" ? "Not now" : "Hide"}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const { recovery, readAt } = view;
  // The arrow's direction is the call: the accent can be any of six hues,
  // gold among them, so colour alone can't tell good from bad. It marks
  // the good day only, as the accent does everywhere.
  const Icon =
    recovery.verdict === "ready" ? ArrowUpRight : recovery.verdict === "steady" ? ArrowRight : ArrowDownRight;
  const updated = new Date(readAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <section>
      <SectionLabel action={<span className="tnum text-[13px] text-muted">Updated {updated}</span>}>
        Recovery
      </SectionLabel>
      <div className="overflow-hidden rounded-2xl bg-surface">
        <div className="flex items-start gap-3 px-4 pt-4">
          <Icon
            aria-hidden
            strokeWidth={2.5}
            className={cn(
              "mt-0.5 size-5 shrink-0",
              recovery.verdict === "ready" ? "text-accent" : "text-muted",
            )}
          />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-[-0.01em] text-text">{recovery.headline}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-muted">{recovery.advice}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[1.2fr_1fr_1fr] divide-x divide-text/[0.06] border-t border-text/[0.06] py-3.5">
          <Cell label="Sleep" reading={recovery.sleep} show={formatSleep}>
            <Spark values={recovery.trend.sleepMin} usual={recovery.sleep?.usual ?? null} bars label="Sleep, two weeks" />
          </Cell>
          <Cell label="HRV" unit="ms" reading={recovery.hrv} show={(v) => String(Math.round(v))}>
            <Spark values={recovery.trend.hrv} usual={recovery.hrv?.usual ?? null} label="HRV, two weeks" />
          </Cell>
          <Cell label="Resting" unit="bpm" reading={recovery.rhr} show={(v) => String(Math.round(v))}>
            <Spark values={recovery.trend.rhr} usual={recovery.rhr?.usual ?? null} label="Resting heart rate, two weeks" />
          </Cell>
        </dl>
        {recovery.signals.length > 0 && (
          <ul className="divide-y divide-text/[0.06] border-t border-text/[0.06]">
            {recovery.signals.slice(0, 5).map((s) => (
              <li key={s.key} className="flex items-start gap-2.5 px-4 py-2.5">
                <ToneMark tone={s.tone} />
                <span className={cn("text-[14px] leading-5", s.tone === "good" ? "text-muted" : "text-text")}>
                  {s.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Good, fair or poor as a shape, not only a shade: a tick, a dash, an arrow down. */
function ToneMark({ tone }: { tone: Tone }) {
  const Mark = tone === "good" ? Check : tone === "fair" ? Minus : ArrowDown;
  return (
    <span
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
        tone === "good" ? "bg-text/[0.06] text-muted" : tone === "fair" ? "bg-text/[0.1] text-text" : "bg-text text-bg",
      )}
    >
      <Mark aria-hidden className="size-2.5" strokeWidth={3} />
      <span className="sr-only">{tone === "good" ? "Good:" : tone === "fair" ? "A little off:" : "Off:"}</span>
    </span>
  );
}

/**
 * Two weeks of a reading, no axes: a line (or bars, for sleep) with a faint
 * rule at the usual and today's point marked. It draws in from the left once,
 * when the card appears.
 */
function Spark({
  values,
  usual,
  bars = false,
  label,
}: {
  values: (number | null)[];
  usual: number | null;
  bars?: boolean;
  label: string;
}) {
  const present = values.filter((v): v is number => v != null);
  if (present.length < 3) return null;
  const W = 100;
  const H = 28;
  const lo = Math.min(...present, usual ?? Infinity);
  const hi = Math.max(...present, usual ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (values.length === 1 ? W : (i / (values.length - 1)) * W);
  const y = (v: number) => H - 2 - ((v - lo) / span) * (H - 4);
  const lastIndex = values.findLastIndex((v) => v != null);

  let line = "";
  if (!bars) {
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      line += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="hb-spark mt-2 block h-7 w-full overflow-visible"
    >
      {usual != null && (
        <line
          x1="0"
          x2={W}
          y1={y(usual)}
          y2={y(usual)}
          stroke="currentColor"
          className="text-text/20"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {bars
        ? values.map((v, i) =>
            v == null ? null : (
              <rect
                key={i}
                x={x(i) - 2.2}
                width={4.4}
                y={y(v)}
                height={H - y(v)}
                rx={1.2}
                className={i === lastIndex ? "fill-text" : "fill-text/30"}
              />
            ),
          )
        : (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="text-text/60"
          />
        )}
      {!bars && lastIndex >= 0 && values[lastIndex] != null && (
        <circle cx={x(lastIndex)} cy={y(values[lastIndex]!)} r={2.6} className="fill-text" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/** Room each unit needs beside its figure, for fitting the figure. */
const UNIT_ROOM: Record<string, string> = { ms: "1.5rem", bpm: "1.875rem" };

function Cell({
  label,
  unit,
  reading,
  show,
  children,
}: {
  label: string;
  unit?: string;
  reading: Reading | null;
  show: (value: number) => string;
  children?: React.ReactNode;
}) {
  const value = reading ? show(reading.value) : "–";
  return (
    <div className="@container min-w-0 px-3 [--stat-max:1.5rem] min-[400px]:px-4">
      <dt className="truncate text-[13px] text-muted">{label}</dt>
      <dd>
        <p className="mt-1.5 flex h-6 items-end leading-none">
          <span className="whitespace-nowrap">
            <span
              className="font-display hb-fit text-text"
              style={fitFigure(value, "var(--stat-max)", reading && unit ? UNIT_ROOM[unit] : "0px")}
            >
              {value}
            </span>
            {reading && unit && <span className="ml-1 text-[13px] text-muted">{unit}</span>}
          </span>
        </p>
        <p className="tnum mt-1.5 truncate text-[13px] text-muted">
          {!reading
            ? "No reading"
            : reading.usual == null
              ? "Learning"
              : `usual ${show(reading.usual)}`}
        </p>
        {children}
      </dd>
    </div>
  );
}

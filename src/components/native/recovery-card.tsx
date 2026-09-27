"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/page-header";
import { isNativeApp } from "@/lib/native";
import { nativePlugin } from "@/lib/native-plugins";
import { assessRecovery, formatSleep, type Reading, type Recovery } from "@/lib/recovery";
import { cn, fitFigure } from "@/lib/utils";

const KEY = "hell-blazer:recovery";

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
  | { kind: "ready"; recovery: Recovery };

/**
 * iPhone app only: how recovered you are this morning, from Apple Health's
 * sleep, heart rate variability and resting heart rate (src/lib/recovery.ts).
 * Read on the phone and never sent anywhere. Until Health has been asked,
 * it offers to connect; "Not now" hides it (Settings brings it back).
 * Renders nothing on the website, or in an app build without the readings.
 */
export function RecoveryCard() {
  const [view, setView] = useState<RecoveryView>({ kind: "hidden" });

  const load = useCallback(async (justAsked = false) => {
    const plugin = nativePlugin();
    if (!plugin || !recoveryOnHome()) return;
    try {
      const { api } = await plugin;
      const status = await api.recoveryStatus();
      if (!status.available) return setView({ kind: "hidden" });
      if (status.shouldRequest) return setView({ kind: "ask" });
      const { days } = await api.recoveryData();
      const recovery = assessRecovery(days);
      setView(recovery ? { kind: "ready", recovery } : justAsked ? { kind: "empty" } : { kind: "hidden" });
    } catch {
      // An app build from before Recovery: nothing to show.
      setView({ kind: "hidden" });
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;
    const frame = window.requestAnimationFrame(() => void load());
    // Opened again in the morning, from the background: today's numbers.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function connect() {
    const plugin = nativePlugin();
    if (!plugin) return;
    try {
      const { api } = await plugin;
      await api.requestHealth();
    } catch {
      // The sheet failed to show; the card stays as it was.
    }
    await load(true);
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
              ? "Fatty can read your sleep, heart rate variability and resting heart rate from Apple Health, and tell you each morning whether to go hard or go lighter. It stays on this iPhone."
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

  const { recovery } = view;
  // The arrow's direction is the call: the accent can be any of six hues,
  // gold among them, so colour alone can't tell good from bad. It marks
  // the good day only, as the accent does everywhere.
  const Icon =
    recovery.verdict === "ready" ? ArrowUpRight : recovery.verdict === "steady" ? ArrowRight : ArrowDownRight;
  return (
    <section>
      <SectionLabel action={<span className="text-[13px] text-muted">Against your usual</span>}>
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
        <dl className="mt-4 grid grid-cols-[1.2fr_1fr_1fr] divide-x divide-white/[0.06] border-t border-white/[0.06] py-3.5">
          <Cell label="Sleep" reading={recovery.sleep} show={formatSleep} />
          <Cell label="HRV" unit="ms" reading={recovery.hrv} show={(v) => String(Math.round(v))} />
          <Cell label="Resting" unit="bpm" reading={recovery.rhr} show={(v) => String(Math.round(v))} />
        </dl>
      </div>
    </section>
  );
}

/** Room each unit needs beside its figure, for fitting the figure. */
const UNIT_ROOM: Record<string, string> = { ms: "1.5rem", bpm: "1.875rem" };

function Cell({
  label,
  unit,
  reading,
  show,
}: {
  label: string;
  unit?: string;
  reading: Reading | null;
  show: (value: number) => string;
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
      </dd>
    </div>
  );
}

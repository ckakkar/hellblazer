"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { HeartPulse, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fitFigure } from "@/lib/utils";
import { hasOnDeviceModel, nativePlugin } from "@/lib/native-plugins";
import {
  analyzeHeart,
  heartFacts,
  heartTemplate,
  usualOf,
  type HeartInsights,
  type HeartUsual,
  type TimedSet,
} from "@/lib/heart-insights";

type View =
  | { at: "hidden" }
  | { at: "ask" }
  | { at: "waiting" }
  | { at: "ready"; h: HeartInsights; usual: HeartUsual };

/** Sessions read on this phone, for "usually": device-only, like the readings. */
const HISTORY_KEY = "hell-blazer:heart-history";
const summaryKey = (id: string) => `hell-blazer:heart-summary:${id}`;
/** How long after a finish the watch's readings may still be on their way to the phone. */
const SYNC_WAIT_MS = 10 * 60_000;
const POLL_MS = 15_000;

type Past = { id: string; start: number; recovery: number | null; load: number };

/** The summary written for these facts before, if any. */
function keptSummary(sessionId: string, facts: string): string | null {
  try {
    const kept = JSON.parse(localStorage.getItem(summaryKey(sessionId)) ?? "null") as {
      facts: string;
      text: string;
    } | null;
    return kept?.facts === facts ? kept.text : null;
  } catch {
    return null;
  }
}

function readPast(): Past[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(list) ? (list as Past[]) : [];
  } catch {
    return [];
  }
}

/** Keeps this session's numbers; returns the usual from the sessions before it. */
function rememberAndCompare(entry: Past): HeartUsual {
  const others = readPast().filter((p) => p.id !== entry.id);
  try {
    const kept = [...others, entry].sort((a, b) => a.start - b.start).slice(-60);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
  } catch {
    // Storage blocked: no "usually", nothing else lost.
  }
  return usualOf(others.filter((p) => p.start < entry.start).sort((a, b) => a.start - b.start));
}

/**
 * The heart-rate read on a finished session, from the Apple Watch's readings
 * in Health: a summary written on the phone by Apple's on-device model, the
 * trace with the sets on it, the exercise that pushed hardest, recovery
 * between sets, rests cut short, and the time in each zone. Only on iPhones
 * that run that model (15 Pro or newer, Apple Intelligence on), and only
 * for workouts the watch recorded; the readings never leave the phone.
 */
export function HeartCard({
  sessionId,
  start,
  end,
  sets,
  maxHr,
}: {
  sessionId: string;
  /** Epoch ms. */
  start: number;
  end: number;
  sets: TimedSet[];
  /** From the lifter's age; null to estimate from the workout. */
  maxHr: number | null;
}) {
  const [view, setView] = useState<View>({ at: "hidden" });
  const [summary, setSummary] = useState<{ text: string; written: boolean } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function load() {
      const plugin = nativePlugin();
      if (!plugin || !(await hasOnDeviceModel())) return;
      try {
        const { api } = await plugin;
        const reply = await api.workoutHeartRate({ start, end });
        if (!live) return;
        const h = analyzeHeart(reply.samples ?? [], sets, { start, end, resting: reply.resting ?? null, maxHr });
        if (h) {
          const usual = rememberAndCompare({ id: sessionId, start, recovery: h.recovery, load: h.load });
          setView({ at: "ready", h, usual });
          return;
        }
        // Asking only makes sense with a watch that records workouts.
        const watch = await api.watchStatus().catch(() => null);
        if (!live) return;
        if (reply.ask && watch?.installed) {
          setView({ at: "ask" });
        } else if (watch?.installed && Date.now() - end < SYNC_WAIT_MS) {
          setView({ at: "waiting" });
          timer = setTimeout(() => void load(), POLL_MS);
        } else {
          setView({ at: "hidden" });
        }
      } catch {
        // An app build from before this feature, or Health unavailable.
        if (live) setView({ at: "hidden" });
      }
    }
    void load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, start, end, sets, maxHr, reload]);

  // The summary: kept per session, written again only if the facts change.
  const facts = view.at === "ready" ? heartFacts(view.h, view.usual).join("\n") : null;
  const kept = facts ? keptSummary(sessionId, facts) : null;
  useEffect(() => {
    if (view.at !== "ready" || !facts || kept) return;
    const fallback = heartTemplate(view.h, view.usual);
    let live = true;
    const plugin = nativePlugin();
    if (!plugin) return;
    void plugin
      .then(({ api }) => api.heartSummary({ facts }))
      .then(({ text }) => {
        if (!live) return;
        setSummary({ text, written: true });
        try {
          localStorage.setItem(summaryKey(sessionId), JSON.stringify({ facts, text }));
        } catch {
          // Written again next time.
        }
      })
      .catch(() => {
        if (live) setSummary({ text: fallback, written: false });
      });
    return () => {
      live = false;
    };
  }, [view, facts, kept, sessionId]);

  if (view.at === "hidden") return null;

  if (view.at === "ask" || view.at === "waiting") {
    return (
      <section className="mb-8 rounded-2xl bg-surface p-4">
        <Title />
        {view.at === "ask" ? (
          <>
            <p className="mt-2 text-[15px] leading-[1.5] text-muted">
              See when this workout pushed you hardest and how fast you recovered between sets, from
              your Apple Watch. It&apos;s all worked out on this iPhone.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                void nativePlugin()
                  ?.then(({ api }) => api.requestHeartRate())
                  .then(() => setReload((n) => n + 1))
                  .catch(() => {});
              }}
            >
              Connect heart rate
            </Button>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-[15px] text-muted">
            <Loader2 className="size-4 animate-spin" />
            Waiting for your Apple Watch&apos;s heart rate
          </p>
        )}
      </section>
    );
  }

  const { h, usual } = view;
  const shown = kept ? { text: kept, written: true } : summary;
  const hardest = h.exercises.slice(0, 4);
  return (
    <section className="mb-8 rounded-2xl bg-surface p-4">
      <Title />
      {shown ? (
        <>
          <p className="mt-3 text-[15px] leading-[1.5] text-text">{shown.text}</p>
          {shown.written && <p className="mt-1 text-[13px] text-muted">Written on this iPhone.</p>}
        </>
      ) : (
        <div aria-hidden className="mt-3 space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl bg-white/[0.03] py-3">
        {[
          { label: "Average", value: String(h.avg), unit: "bpm" },
          { label: "Peak", value: String(h.peak), unit: "bpm" },
          { label: "Load", value: String(h.load), unit: usual.load != null ? `usually ${usual.load}` : "" },
        ].map((st) => (
          <div key={st.label} className="@container min-w-0 px-3">
            <p className="text-[13px] text-muted">{st.label}</p>
            <p className="mt-1 flex items-baseline gap-1 whitespace-nowrap leading-none">
              <span className="font-display hb-fit text-text" style={fitFigure(st.value, "1.375rem", "2rem")}>
                {st.value}
              </span>
              {st.unit && <span className="truncate text-[12px] text-muted">{st.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <HeartChart h={h} start={start} end={end} names={new Map(h.exercises.map((e) => [e.key, e.name]))} />

      <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-white/[0.03]">
        {hardest.length > 0 && (
          <li className="px-3.5 py-3">
            <p className="text-[13px] text-muted">Hardest exercises, by peak</p>
            <ol className="mt-1.5 space-y-1">
              {hardest.map((e) => (
                <li key={e.key} className="tnum flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="min-w-0 truncate text-text">{e.name}</span>
                  <span className="shrink-0 text-muted">{e.peak} bpm</span>
                </li>
              ))}
            </ol>
          </li>
        )}
        {h.recovery != null && (
          <li className="flex items-baseline justify-between gap-3 px-3.5 py-3 text-[15px]">
            <span className="text-muted">Recovery</span>
            <span className="tnum text-right text-text">
              {h.recovery} bpm in a minute
              {usual.recovery != null && <span className="block text-[13px] text-muted">usually {usual.recovery}</span>}
            </span>
          </li>
        )}
        {h.restsJudged > 0 && (
          <li className="flex items-baseline justify-between gap-3 px-3.5 py-3 text-[15px]">
            <span className="text-muted">Rests cut short</span>
            <span className="tnum text-text">
              {h.shortRests} of {h.restsJudged}
            </span>
          </li>
        )}
      </ul>

      <Zones zones={h.zones} />
    </section>
  );
}

function Title() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-text">
        <HeartPulse className="size-4 text-muted" />
        Heart rate
      </h2>
      <span className="text-[13px] text-muted">Apple Watch</span>
    </div>
  );
}

/** Time in each zone as one bar, a step brighter per zone, and the minutes under it. */
function Zones({ zones }: { zones: number[] }) {
  const total = zones.reduce((n, m) => n + m, 0);
  if (total <= 0) return null;
  const shade = [0.22, 0.38, 0.56, 0.76, 1];
  return (
    <div className="mt-4">
      <p className="text-[13px] text-muted">Time in each zone</p>
      <div
        role="img"
        aria-label={zones.map((m, i) => `Zone ${i + 1}: ${Math.round(m)} minutes`).join(", ")}
        className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-full"
      >
        {zones.map((m, i) =>
          m > 0 ? (
            <span key={i} className="h-full bg-text" style={{ flexGrow: m, opacity: shade[i] }} />
          ) : null,
        )}
      </div>
      <div className="tnum mt-2 grid grid-cols-5 text-center">
        {zones.map((m, i) => (
          <div key={i}>
            <p className="text-[13px] text-text">{Math.round(m)}m</p>
            <p className="text-[11px] text-muted">Zone {i + 1}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const HEIGHT = 140;
const PAD = { left: 30, right: 6, top: 10, bottom: 22 };

/**
 * The trace, one line, with a tick under it for each set. Drag across it
 * for the reading at any moment and the set it followed.
 */
function HeartChart({
  h,
  start,
  end,
  names,
}: {
  h: HeartInsights;
  start: number;
  end: number;
  names: Map<string, string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);

  const bpms = h.samples.map((s) => s.bpm);
  const lo = Math.floor((Math.min(...bpms) - 5) / 10) * 10;
  const hi = Math.ceil((h.peak + 5) / 10) * 10;
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * plotW;
  const y = (bpm: number) => PAD.top + ((hi - bpm) / (hi - lo)) * plotH;
  const path = h.samples.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.bpm).toFixed(1)}`).join("");
  const grid = [lo, Math.round((lo + hi) / 2 / 10) * 10, hi];
  const minutes = Math.round((end - start) / 60_000);

  const point = hover != null ? h.samples[hover] : null;
  const after = point
    ? [...h.marks].reverse().find((m) => m.at - 40_000 <= point.t && point.t - m.at <= 90_000)
    : null;

  function track(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const t = start + ((clientX - rect.left - PAD.left) / plotW) * (end - start);
    let best = 0;
    h.samples.forEach((s, i) => {
      if (Math.abs(s.t - t) < Math.abs(h.samples[best].t - t)) best = i;
    });
    setHover(best);
  }

  return (
    <div ref={box} className="relative mt-4 select-none" style={{ height: HEIGHT, touchAction: "pan-y" }}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Heart rate over the ${minutes}-minute workout, between ${Math.min(...bpms)} and ${h.peak} bpm.`}
          onPointerMove={(e) => track(e.clientX)}
          onPointerDown={(e) => track(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          {grid.map((g) => (
            <g key={g}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(g)} y2={y(g)} className="stroke-white/[0.07]" />
              <text x={PAD.left - 6} y={y(g) + 4} textAnchor="end" className="tnum fill-muted text-[11px]">
                {g}
              </text>
            </g>
          ))}
          {h.marks.map((m) => (
            <rect
              key={m.at}
              x={x(m.at) - 1}
              y={HEIGHT - PAD.bottom + 4}
              width={2}
              height={6}
              rx={1}
              className="fill-muted/60"
            />
          ))}
          <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-text" />
          <text x={PAD.left} y={HEIGHT - 2} className="tnum fill-muted text-[11px]">
            0
          </text>
          <text x={width - PAD.right} y={HEIGHT - 2} textAnchor="end" className="tnum fill-muted text-[11px]">
            {minutes} min
          </text>
          {point && (
            <g>
              <line
                x1={x(point.t)}
                x2={x(point.t)}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                className="stroke-white/25"
                strokeWidth={1}
              />
              <circle cx={x(point.t)} cy={y(point.bpm)} r={4} strokeWidth={2} className="fill-text stroke-surface" />
            </g>
          )}
        </svg>
      )}
      {point && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] shadow-raised"
          style={{ left: Math.min(Math.max(x(point.t), 64), width - 64) }}
        >
          <p className="tnum whitespace-nowrap text-text">
            {point.bpm} bpm, {Math.max(0, Math.round((point.t - start) / 60_000))} min in
          </p>
          {after && <p className="max-w-40 truncate text-muted">after {names.get(after.key) ?? "a set"}</p>}
        </div>
      )}
    </div>
  );
}

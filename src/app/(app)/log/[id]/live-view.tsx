"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn, fitFigure } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useElapsed } from "@/components/resume-banner";
import { FighterArt } from "@/components/tier/fighter-art";
import { Portal } from "@/components/ui/portal";
import { VictoryScreen } from "@/components/workout/victory-screen";
import { formatElapsed } from "@/lib/workout-clock";
import { randomVictory } from "@/lib/hype";
import { useKeepAwake } from "@/lib/keep-awake";
import { MUSCLE_LABEL } from "@/lib/muscles";
import { kgToLb, toDisplayWeight, trimNum, type Unit } from "@/lib/units";
import { estimatedMax, type BoardExercise, type BoardSet, type LiveBoard } from "@/lib/live-board";
import type { LastPerformance } from "@/lib/data/sessions";
import type { TierKey } from "@/lib/tiers";

/** How long a finished workout's bell holds before the session page. */
const BELL_MS = 4200;
/** A backstop in case a change never arrives over the socket. */
const BACKSTOP_MS = 30_000;

/**
 * The iPad's view of a workout under way on the iPhone or the watch. Nothing
 * here logs or changes anything: it's the arena screen. Sets land as they're
 * logged (the set table streams over Supabase Realtime), a broken record
 * rings the screen as it does on the phone, and the final bell plays when
 * the workout's finished, then hands over to the session's page. The screen
 * stays on while it's live (Keep screen on, in Profile).
 */
export function LiveView({
  sessionId,
  userId,
  title,
  startedAt,
  finishedAt,
  durationMin,
  board,
  last,
  unit,
  fighter,
}: {
  sessionId: string;
  userId: string;
  title: string;
  startedAt: string;
  finishedAt: string | null;
  durationMin: number | null;
  board: LiveBoard;
  last: Record<string, LastPerformance>;
  unit: Unit;
  fighter: TierKey;
}) {
  const router = useRouter();
  useLiveRefresh(userId);
  // An iPad on a stand stays awake for the whole bout.
  useKeepAwake(finishedAt == null);

  // Sets on the board when the page opened don't animate; ones that arrive do.
  const [seen] = useState(() => new Set(board.exercises.flatMap((e) => e.sets.map((s) => s.id))));
  const latest = board.exercises.flatMap((e) => e.sets).find((s) => s.id === board.latestSetId) ?? null;
  const current = board.exercises.find((e) => e.id === board.currentId) ?? null;

  // A record that lands while watching gets its moment.
  const [removal, setRemoval] = useState<{ id: string; name: string; label: string; value: string } | null>(null);
  const [heard, setHeard] = useState("");
  const [shownLatest, setShownLatest] = useState(board.latestSetId);
  if (board.latestSetId !== shownLatest) {
    setShownLatest(board.latestSetId);
    if (latest && current && !seen.has(latest.id)) {
      setHeard(`${current.name}, set ${latest.number}: ${weightLabel(latest.weightKg, unit)} ${unit} for ${latest.reps}.`);
      if (latest.record) {
        setRemoval({
          id: latest.id,
          name: current.name,
          ...(latest.record === "weight"
            ? { label: "New heaviest", value: `${weightLabel(latest.weightKg, unit)} ${unit} × ${latest.reps}` }
            : {
                label: "New best estimated 1RM",
                value: `${Math.round(toDisplayWeight(estimatedMax(latest.weightKg, latest.reps), unit))} ${unit}`,
              }),
        });
      }
    }
  }
  useEffect(() => {
    if (!removal) return;
    const t = setTimeout(() => setRemoval(null), 2600);
    return () => clearTimeout(t);
  }, [removal]);

  // The bell, if the workout finishes while it's on screen.
  const [openedLive] = useState(finishedAt == null);
  const [bell, setBell] = useState<string | null>(null);
  if (openedLive && finishedAt && bell === null) setBell(randomVictory());
  useEffect(() => {
    if (bell === null) return;
    const t = setTimeout(() => router.replace(`/history/${sessionId}`), BELL_MS);
    return () => clearTimeout(t);
  }, [bell, router, sessionId]);

  const elapsed = useElapsed(startedAt);
  const time = finishedAt
    ? formatElapsed(durationMin != null ? durationMin * 60_000 : Date.parse(finishedAt) - Date.parse(startedAt))
    : elapsed;
  const volume = volumeFigure(board.volumeKg, unit);
  const stats = [
    { label: "Time", value: time ?? "0:00", live: !finishedAt },
    { label: "Working sets", value: String(board.workingSets) },
    { label: "Volume", value: volume.value, unit: volume.unit },
    { label: "Exercises done", value: `${board.doneCount}/${board.exercises.length}` },
  ];

  return (
    <div className="pb-6">
      <p className="sr-only" role="status" aria-live="polite">
        {heard}
      </p>

      {/* Masthead and scoreboard: the bout's name on the poster, the lifter's
          fighter behind it, faded so it has no edge. */}
      <div className="relative isolate">
        <div
          aria-hidden
          className="hb-live-art pointer-events-none absolute -top-12 right-[-3rem] -z-10 hidden h-[26rem] w-[56%] [--hb-fade:var(--color-bg)] md:block"
        >
          <FighterArt
            fighterKey={fighter}
            variant="hero"
            fade="bottom"
            className="absolute inset-0"
            imageClassName="object-[50%_14%] opacity-60"
          />
        </div>
        <header>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            {finishedAt ? (
              <span className="font-medium text-text">Final</span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-accent-ink">
                <span className="size-2 rounded-full bg-accent" aria-hidden />
                Live
              </span>
            )}
            <span className="text-muted">
              {format(new Date(startedAt), "EEE d MMM")}, started {format(new Date(startedAt), "HH:mm")}
            </span>
          </div>
          <h1 className="font-display mt-3 max-w-[18ch] text-balance text-[clamp(2.25rem,5.6vw,4.75rem)] leading-[0.95] text-text">
            {title}
          </h1>
          {board.records > 0 && (
            <p className="mt-3 text-[15px] font-medium text-accent-ink">
              {board.records === 1 ? "1 record broken" : `${board.records} records broken`}
            </p>
          )}
          {finishedAt && (
            <Link
              href={`/history/${sessionId}`}
              transitionTypes={["nav-forward"]}
              className="mt-4 inline-flex items-center gap-1 text-[15px] font-medium text-text"
            >
              See the session
              <ChevronRight className="size-4" />
            </Link>
          )}
        </header>

        {/* The scoreboard, ruled off on the page like the home's week. */}
        <dl className="mt-7 grid grid-cols-2 gap-y-6 border-y border-white/[0.08] py-6 sm:grid-cols-4 sm:divide-x sm:divide-white/[0.06] lg:mt-10 lg:py-8">
          {stats.map((st) => (
            <div
              key={st.label}
              className="@container min-w-0 px-1 [--stat-max:2.25rem] sm:px-5 sm:first:pl-1 lg:px-7 lg:[--stat-max:3.75rem]"
            >
              <dt className="truncate text-[13px] text-muted lg:text-[15px]">{st.label}</dt>
              <dd className="mt-2 flex h-9 items-end leading-none lg:mt-3 lg:h-[3.75rem]">
                <span className="whitespace-nowrap">
                  <span
                    className={cn("font-display hb-fit", st.live ? "text-accent" : "text-text")}
                    style={fitFigure(st.value, "var(--stat-max)", st.unit ? "1.5rem" : "0px")}
                  >
                    {st.value}
                  </span>
                  {st.unit && <span className="ml-1.5 text-[13px] text-muted lg:text-[17px]">{st.unit}</span>}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        {current ? (
          <OnTheBar exercise={current} hasSet={latest != null} last={last[current.exerciseId]} unit={unit} seen={seen} />
        ) : (
          <p className="rounded-3xl bg-surface p-6 text-[15px] text-muted">No exercises in this workout yet.</p>
        )}
        <TheCard board={board} unit={unit} live={!finishedAt} />
      </div>

      {removal && (
        <Portal>
          <div key={removal.id} aria-hidden className="hb-pr-edge pointer-events-none fixed inset-0 z-[54]" />
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[55] flex justify-center px-4">
            <div className="hb-pr-banner relative w-full max-w-md overflow-hidden rounded-2xl bg-[rgb(22_22_25/0.96)] py-3.5 pl-5 pr-4 shadow-raised backdrop-blur">
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
              <span
                aria-hidden
                className="hb-pr-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="hb-pr-word font-display text-[1.375rem] leading-none text-accent">Removal</span>
                <span className="truncate text-[13px] text-muted">{removal.name}</span>
              </div>
              <p className="mt-3 text-[13px] text-muted">{removal.label}</p>
              <p className="font-display mt-1 text-[1.75rem] leading-none text-text">{removal.value}</p>
            </div>
          </div>
        </Portal>
      )}

      {bell && (
        <VictoryScreen
          word={bell}
          fighter={fighter}
          records={board.records}
          stats={[
            { label: "Volume", value: volume.value, unit: volume.unit },
            { label: "Sets", value: String(board.workingSets) },
            { label: "Time", value: time ?? "0:00" },
          ]}
        />
      )}
    </div>
  );
}

/**
 * The lift being worked. Its newest set is the big number, so the moment a
 * set lands is the thing on screen; the rest of its sets, and the ones still
 * to do, run underneath.
 */
function OnTheBar({
  exercise,
  hasSet,
  last,
  unit,
  seen,
}: {
  exercise: BoardExercise;
  hasSet: boolean;
  last: LastPerformance | undefined;
  unit: Unit;
  seen: Set<string>;
}) {
  const planned = exercise.target ?? 0;
  const toGo = Math.max(0, planned - exercise.sets.filter((s) => !s.warmup && s.kind !== "drop").length);
  const top = exercise.sets.reduce<BoardSet | null>(
    (newest, s) => (!newest || s.createdAt > newest.createdAt ? s : newest),
    null,
  );
  const lastLine = last?.sets.length
    ? last.sets.map((s) => `${weightLabel(s.weight_kg, unit)}×${s.reps}`).join(", ")
    : null;
  const facts = [
    exercise.muscle ? MUSCLE_LABEL[exercise.muscle] : null,
    exercise.target ? `${exercise.target} × ${exercise.reps ?? "?"}` : null,
    exercise.slot ? `superset ${exercise.slot}` : null,
  ].filter(Boolean);

  return (
    <section aria-labelledby="hb-on-bar" className="rounded-3xl bg-surface p-5 sm:p-6 lg:p-7">
      <p className="flex items-baseline justify-between gap-3 text-[13px] text-muted">
        <span>{hasSet ? "On the bar" : "Up first"}</span>
        {top && (
          <span className="tnum">
            Set {top.number}
            {exercise.target ? ` of ${exercise.target}` : ""}
          </span>
        )}
      </p>
      <h2 id="hb-on-bar" className="font-display mt-1.5 text-[clamp(1.5rem,3.2vw,2.25rem)] leading-[1.05] text-text">
        {exercise.name}
      </h2>
      {facts.length > 0 && <p className="mt-1.5 text-[13px] text-muted">{facts.join(", ")}</p>}

      {top ? (
        <div key={top.id} className={cn("mt-7", !seen.has(top.id) && "hb-set-land")}>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 leading-none">
            <span className="whitespace-nowrap">
              <span className="font-display text-[clamp(3rem,7.4vw,5.75rem)] text-text">{weightLabel(top.weightKg, unit)}</span>
              <span className="ml-2 text-[17px] text-muted">{unit}</span>
            </span>
            <span className="font-display whitespace-nowrap text-[clamp(2rem,4.6vw,3.5rem)] text-text">× {top.reps}</span>
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {top.record && (
              <span className="hb-pr-word font-display text-[15px] leading-none text-accent">
                {top.record === "weight" ? "New heaviest" : "New best 1RM"}
              </span>
            )}
            {top.rpe != null && <span className="text-muted">RPE {trimNum(top.rpe)}</span>}
            {top.warmup && <span className="text-muted">Warm-up</span>}
            {top.kind === "drop" && <span className="text-muted">Drop set</span>}
          </p>
        </div>
      ) : (
        <p className="mt-7 text-[15px] text-muted">The first set shows here the moment it&apos;s logged.</p>
      )}

      {(exercise.sets.length > 0 || toGo > 0) && (
        <ol className="mt-7 flex flex-wrap gap-2">
          {exercise.sets.map((s) => (
            <li
              key={s.id}
              className={cn(
                "tnum min-w-[5.5rem] rounded-xl px-3 py-2",
                s.record ? "bg-accent/[0.12] shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.45)]" : "bg-surface-2",
                s.id === top?.id && !s.record && "shadow-[inset_0_0_0_1px_rgb(244_242_238/0.35)]",
                !seen.has(s.id) && "hb-set-land",
              )}
            >
              <span className={cn("block text-[11px]", s.record ? "text-accent-ink" : "text-muted")}>
                {s.record ? "Record" : s.warmup ? "Warm-up" : `Set ${s.number}`}
              </span>
              <span className="block text-[15px] font-medium text-text">
                {weightLabel(s.weightKg, unit)} × {s.reps}
              </span>
            </li>
          ))}
          {Array.from({ length: toGo }).map((_, i) => (
            <li
              key={`to-go-${i}`}
              className="min-w-[5.5rem] rounded-xl border border-dashed border-white/[0.12] px-3 py-2"
            >
              <span className="tnum block text-[11px] text-muted">Set {exercise.sets.length + i + 1}</span>
              <span className="block text-[15px] text-muted">To go</span>
            </li>
          ))}
        </ol>
      )}

      {lastLine && (
        <p className="tnum mt-5 truncate text-[13px] text-muted">
          Last time {lastLine} {unit}
        </p>
      )}
    </section>
  );
}

/** The whole workout in order: done, on the bar, still to come. */
function TheCard({ board, unit, live }: { board: LiveBoard; unit: Unit; live: boolean }) {
  return (
    <section aria-labelledby="hb-the-card" className="self-start rounded-3xl bg-surface py-2">
      <h2 id="hb-the-card" className="px-5 pb-1 pt-3 text-[13px] text-muted">
        The card
      </h2>
      <ol className="divide-y divide-white/[0.06]">
        {board.exercises.map((e) => {
          const now = live && e.id === board.currentId && !e.done;
          const working = e.sets.filter((s) => !s.warmup);
          return (
            <li key={e.id} aria-current={now ? "step" : undefined} className="flex items-start gap-3 px-5 py-3.5">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  e.done ? "bg-text text-bg" : now ? "bg-accent" : "border border-white/[0.18]",
                )}
              >
                {e.done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  {e.slot && (
                    <span className="tnum shrink-0 rounded bg-white/[0.08] px-1 text-[11px] font-semibold text-text">
                      {e.slot}
                    </span>
                  )}
                  <span className={cn("truncate text-[15px] font-medium", e.done || now ? "text-text" : "text-muted")}>
                    {e.name}
                  </span>
                </p>
                {working.length > 0 && (
                  <p className="tnum mt-0.5 truncate text-[13px] text-muted">
                    {working.map((s) => `${weightLabel(s.weightKg, unit)}×${s.reps}`).join(", ")}
                  </p>
                )}
              </div>
              <span className="tnum shrink-0 pt-px text-[13px] text-muted">
                {e.target ? `${e.workingSets}/${e.target}` : e.workingSets > 0 ? `${e.workingSets} sets` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function weightLabel(kg: number, unit: Unit): string {
  return trimNum(toDisplayWeight(kg, unit));
}

function volumeFigure(kg: number, unit: Unit): { value: string; unit: string } {
  const v = unit === "lb" ? kgToLb(kg) : kg;
  return v >= 10_000
    ? { value: `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`, unit }
    : { value: Math.round(v).toLocaleString(), unit };
}

/**
 * Refreshes the page as the phone or the watch logs: the session's sets and
 * exercises stream in over Supabase Realtime (the app layout's RealtimeSync
 * already covers the session itself, so a finish arrives too). Deletes can't
 * be filtered to one lifter, so an undone set shows at the next change, or
 * at the backstop.
 */
function useLiveRefresh(userId: string) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    const channel = supabase.channel("hb-live-board");
    for (const table of ["set", "session_exercise"] as const) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel.on("postgres_changes", { event, schema: "public", table, filter: `user_id=eq.${userId}` }, refresh);
      }
    }
    channel.subscribe();
    const backstop = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, BACKSTOP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.clearInterval(backstop);
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);
}

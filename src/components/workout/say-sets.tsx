"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Mic, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasOnDeviceModel, nativePlugin } from "@/lib/native-plugins";
import {
  groupByExercise,
  parseHeard,
  planSpokenSets,
  type SpokenExercise,
  type SpokenPlan,
  type SpokenSet,
} from "@/lib/spoken-sets";
import { trimNum, type Unit } from "@/lib/units";

type Stage =
  | { at: "closed" }
  | { at: "typing"; error?: string }
  | { at: "reading" }
  | { at: "review"; plan: SpokenPlan };

const EXAMPLE = "Try something like “3 sets of 8 at 80 on bench”.";

function notInWorkout(words: string[]): string {
  const quoted = words.map((w) => `“${w}”`);
  const list = quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}` : quoted[0];
  return `${list} ${quoted.length > 1 ? "aren't" : "isn't"} in this workout`;
}

/** "80 kg × 8", "Bodyweight × 12", with its effort. */
function setLabel(s: SpokenSet, unit: Unit): string {
  const load = s.weight === 0 ? "Bodyweight" : `${trimNum(s.weight)} ${unit}`;
  return `${load} × ${s.reps}${s.rpe != null ? `, RPE ${trimNum(s.rpe)}` : ""}`;
}

/**
 * "Say it": sets typed or dictated in the lifter's own words ("3 sets of 8
 * at 80 on incline, last one was a grinder"), read on the iPhone by Apple's
 * on-device model, shown back, and logged on a tap. Only on iPhones that run
 * that model (15 Pro or newer, Apple Intelligence on); elsewhere it isn't
 * there at all. On the logger it can name any exercise in the workout; in
 * an exercise's sheet the sets go on that one unless another is named.
 */
export function SaySets({
  exercises,
  current,
  unit,
  onLog,
  inSheet = false,
}: {
  exercises: SpokenExercise[];
  /** Where sets go when no exercise is named. */
  current: string | null;
  unit: Unit;
  onLog: (sets: SpokenSet[]) => void;
  /** Inside an exercise's sheet rather than on the logger itself. */
  inSheet?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>({ at: "closed" });
  const [text, setText] = useState("");
  const [logged, setLogged] = useState<string | null>(null);
  const loggedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldId = useId();

  useEffect(() => {
    let live = true;
    void hasOnDeviceModel().then((ok) => {
      if (live) setReady(ok);
    });
    return () => {
      live = false;
      if (loggedTimer.current) clearTimeout(loggedTimer.current);
    };
  }, []);

  if (!ready) return null;

  async function read() {
    const words = text.trim();
    const plugin = nativePlugin();
    if (!words || !plugin) return;
    setStage({ at: "reading" });
    try {
      const { api } = await plugin;
      const { runs } = await api.readSets({ text: words, exercises: exercises.map((e) => e.name), unit });
      const plan = planSpokenSets(parseHeard(runs), exercises, { unit, current });
      if (plan.sets.length > 0) {
        setStage({ at: "review", plan });
      } else if (plan.unmatched.length > 0) {
        setStage({ at: "typing", error: `${notInWorkout(plan.unmatched)}.` });
      } else {
        setStage({ at: "typing", error: `Couldn't tell the reps from that. ${EXAMPLE}` });
      }
    } catch {
      setStage({ at: "typing", error: `Couldn't make that out. ${EXAMPLE}` });
    }
  }

  function log(plan: SpokenPlan) {
    onLog(plan.sets);
    const n = plan.sets.length;
    setText("");
    setStage({ at: "closed" });
    setLogged(`Logged ${n} ${n === 1 ? "set" : "sets"}.`);
    if (loggedTimer.current) clearTimeout(loggedTimer.current);
    loggedTimer.current = setTimeout(() => setLogged(null), 4000);
  }

  const box = inSheet ? "bg-white/[0.04]" : "bg-surface";

  if (stage.at === "closed") {
    return (
      <div>
        {inSheet ? (
          <Button variant="ghost" size="lg" className="w-full" onClick={() => setStage({ at: "typing" })}>
            <Mic className="size-4" />
            Say it instead
          </Button>
        ) : (
          <button
            onClick={() => setStage({ at: "typing" })}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text">
              <Mic className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-text">Say it</span>
              <span className="block text-[13px] text-muted">
                Type or dictate what you did, on any exercise here.
              </span>
            </span>
          </button>
        )}
        {logged && (
          <p role="status" className="mt-2 px-1 text-[13px] text-muted">
            {logged}
          </p>
        )}
      </div>
    );
  }

  if (stage.at === "review") {
    const { plan } = stage;
    const n = plan.sets.length;
    return (
      <div className={cn("rounded-2xl p-4", box)}>
        <p className="text-[15px] font-medium text-text">Is this right?</p>
        <div className="mt-3 space-y-3">
          {groupByExercise(plan.sets).map(({ exerciseId, sets }) => {
            const runs: { label: string; warmup: boolean; count: number }[] = [];
            for (const s of sets) {
              const label = setLabel(s, unit);
              const run = runs.at(-1);
              if (run && run.label === label && run.warmup === s.warmup) run.count++;
              else runs.push({ label, warmup: s.warmup, count: 1 });
            }
            return (
              <div key={exerciseId}>
                <p className="truncate text-[15px] text-text">
                  {exercises.find((e) => e.id === exerciseId)?.name ?? "Exercise"}
                </p>
                <ul className="tnum mt-1 space-y-0.5 text-[13px] text-muted">
                  {runs.map((run, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {run.warmup ? `Warm-up, ${run.label}` : run.label}
                      </span>
                      <span className="shrink-0">
                        {run.count} {run.count === 1 ? "set" : "sets"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {(plan.unmatched.length > 0 || plan.unclear > 0) && (
          <p className="mt-3 flex gap-2 text-[13px] leading-5 text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {plan.unmatched.length > 0 && `${notInWorkout(plan.unmatched)}, so it's left out. `}
              {plan.unclear > 0 && "Part of it had no reps to go on, so it's left out."}
            </span>
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setStage({ at: "typing" })}>
            Change
          </Button>
          <Button className="flex-1" onClick={() => log(plan)}>
            Log {n} {n === 1 ? "set" : "sets"}
          </Button>
        </div>
      </div>
    );
  }

  const reading = stage.at === "reading";
  const error = stage.at === "typing" ? stage.error : undefined;
  return (
    <div className={cn("rounded-2xl p-4", box)}>
      <label htmlFor={fieldId} className="text-[15px] font-medium text-text">
        Say it
      </label>
      <textarea
        id={fieldId}
        autoFocus
        rows={3}
        maxLength={500}
        enterKeyHint="done"
        value={text}
        disabled={reading}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void read();
          }
        }}
        placeholder={
          inSheet ? "8 at 80, then 6 at 85" : "3 sets of 8 at 80 on incline, last one was a grinder"
        }
        className={cn(
          "mt-2 block w-full resize-none rounded-xl px-3.5 py-3 text-base text-text placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/25 disabled:opacity-60",
          inSheet ? "bg-white/[0.06]" : "bg-surface-2",
        )}
      />
      {error ? (
        <p role="alert" className="mt-2 flex gap-2 text-[13px] leading-5 text-warn">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-muted">Tap the keyboard&apos;s mic to say it. It&apos;s read on this iPhone.</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={reading}
          onClick={() => {
            setText("");
            setStage({ at: "closed" });
          }}
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={reading || !text.trim()} onClick={() => void read()}>
          {reading && <Loader2 className="size-4 animate-spin" />}
          {reading ? "Reading" : "Read it"}
        </Button>
      </div>
    </div>
  );
}

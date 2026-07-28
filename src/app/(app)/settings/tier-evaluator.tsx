"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Lock,
  Minus,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TierLadder } from "@/components/tier/tier-ui";
import { cn } from "@/lib/utils";
import { getTier, MAX_RANK } from "@/lib/tiers";
import { evaluateTier, type EvalResult } from "@/lib/actions/evaluation";
import { setTier } from "@/lib/actions/profile";
import {
  EVAL_COOLDOWN_DAYS,
  daysUntil,
  type EvalGate,
} from "@/lib/evaluation-rules";

export function TierEvaluator({
  currentTierKey,
  rationale,
  evaluatedAt,
  gate,
}: {
  currentTierKey: string | null;
  rationale: string | null;
  evaluatedAt: string | null;
  gate: EvalGate;
}) {
  const [pending, start] = useTransition();
  const [accepting, startAccept] = useTransition();
  const [result, setResult] = useState<EvalResult | null>(null);

  const current = getTier(currentTierKey);
  const currentRank = current?.rank ?? 0;

  function run() {
    setResult(null);
    start(async () => {
      const r = await evaluateTier();
      setResult(r);
    });
  }

  function accept() {
    if (!result?.ok) return;
    startAccept(async () => {
      await setTier({ tierKey: result.tierKey, rationale: result.rationale });
      setResult(null);
    });
  }

  const direction =
    result?.ok && current
      ? result.rank > current.rank
        ? "up"
        : result.rank < current.rank
          ? "down"
          : "same"
      : "up";

  const gateCopy =
    gate.reason === "no_workout"
      ? "Finish a workout first: the judge rules on logged work, nothing else."
      : gate.reason === "no_new_workout"
        ? "You've already been judged on this record. Log another workout to earn a fresh verdict."
        : gate.reason === "cooldown"
          ? `The judge has ruled. Return in ${
              gate.nextRunAt ? daysUntil(gate.nextRunAt) : EVAL_COOLDOWN_DAYS
            } ${
              gate.nextRunAt && daysUntil(gate.nextRunAt) === 1
                ? "day"
                : "days"
            }: one evaluation every ${EVAL_COOLDOWN_DAYS} days.`
          : "Sends your full training history to DeepSeek for a verdict. You choose whether to accept the result.";

  return (
    <div className="grid gap-4">
      {/* Current rank hero */}
      <Card className="overflow-hidden">
        <div className="relative p-5">
          <div
            aria-hidden
            className="hb-halftone pointer-events-none absolute inset-0 opacity-25"
            style={{
              maskImage:
                "radial-gradient(circle at 85% 15%, black, transparent 60%)",
              WebkitMaskImage:
                "radial-gradient(circle at 85% 15%, black, transparent 60%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-8 select-none font-display text-[9rem] font-bold leading-none text-white/[0.03]"
          >
            力
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
            Current rank
          </div>
          {current ? (
            <>
              <div className="mt-1 font-impact text-4xl uppercase leading-none text-accent sm:text-5xl">
                {current.name}
              </div>
              <div className="mt-1 font-display text-sm font-semibold uppercase tracking-[0.12em] text-accent/80">
                {current.epithet}
              </div>
              <div className="mt-1 font-mono text-xs text-muted">
                Rank {current.rank} / {MAX_RANK} · {current.blurb}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 font-impact text-4xl uppercase leading-none text-muted">
                Unranked
              </div>
              <div className="mt-1 text-xs text-muted">
                Run an evaluation to be judged.
              </div>
            </>
          )}
          <TierLadder rank={currentRank} className="mt-4" />
          {rationale && (
            <p className="mt-4 border-l-2 border-accent/40 pl-3 text-sm italic text-muted">
              “{rationale}”
            </p>
          )}
          {evaluatedAt && (
            <p className="mt-2 font-mono text-[11px] text-muted/60">
              last judged {new Date(evaluatedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </Card>

      <div>
        <Button
          onClick={run}
          disabled={pending || !gate.canRun}
          size="lg"
          className="w-full sm:w-auto"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : gate.canRun ? (
            <Swords className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
          {pending
            ? "The judge deliberates…"
            : gate.canRun
              ? "Step forward to be judged"
              : "The judge is closed"}
        </Button>
        <p className="mt-2 text-xs text-muted">{gateCopy}</p>
        {gate.canRun && (
          <p className="mt-1 font-mono text-[11px] text-muted/60">
            {gate.newWorkouts} new{" "}
            {gate.newWorkouts === 1 ? "workout" : "workouts"} to judge · one
            evaluation every {EVAL_COOLDOWN_DAYS} days
          </p>
        )}
      </div>

      {result && !result.ok && (
        <Card
          className={cn(
            "p-4 text-sm",
            result.error === "not_configured"
              ? "border-warn/30 text-warn"
              : "border-border text-muted",
          )}
        >
          {result.message}
        </Card>
      )}

      {result && result.ok && (
        <Card className="hb-slam overflow-hidden border-accent/30">
          <div className="p-5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              The verdict
              {direction === "up" && (
                <span className="inline-flex items-center gap-0.5 text-accent">
                  <ArrowUpRight className="size-3.5" /> ascended
                </span>
              )}
              {direction === "down" && (
                <span className="inline-flex items-center gap-0.5 text-danger">
                  <ArrowDownRight className="size-3.5" /> fallen
                </span>
              )}
              {direction === "same" && (
                <span className="inline-flex items-center gap-0.5 text-muted">
                  <Minus className="size-3.5" /> held
                </span>
              )}
            </div>
            <div className="mt-1 font-impact text-5xl uppercase leading-none text-accent">
              {result.tierName}
            </div>
            {getTier(result.tierKey)?.epithet && (
              <div className="mt-1 font-display text-sm font-semibold uppercase tracking-[0.12em] text-accent/80">
                {getTier(result.tierKey)!.epithet}
              </div>
            )}
            <div className="mt-1 font-mono text-xs text-muted">
              Rank {result.rank} / {MAX_RANK}
            </div>
            <TierLadder rank={result.rank} className="mt-4" />
            <p className="mt-4 text-sm text-text">{result.rationale}</p>
            {result.highlights.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {result.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-muted"
                  >
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-accent" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={accept}
                disabled={accepting}
                className="w-full sm:w-auto"
              >
                {accepting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Accept: become {result.tierName}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setResult(null)}
                className="w-full sm:w-auto"
              >
                Keep {current ? current.name : "unranked"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

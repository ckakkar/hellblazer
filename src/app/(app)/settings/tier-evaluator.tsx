"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Infinity as InfinityIcon,
  Loader2,
  Lock,
  Minus,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierLadder } from "@/components/tier/tier-ui";
import { cn } from "@/lib/utils";
import { getTier, MAX_RANK } from "@/lib/tiers";
import { evaluateTier, type EvalResult } from "@/lib/actions/evaluation";
import { acceptTier, declineTier } from "@/lib/actions/profile";
import {
  EVAL_COOLDOWN_DAYS,
  daysUntil,
  type EvalGate,
} from "@/lib/evaluation-rules";

export function TierEvaluator({
  currentTierKey,
  rationale,
  evaluatedLabel,
  gate,
}: {
  currentTierKey: string | null;
  rationale: string | null;
  /** When the current rank was awarded, pre-formatted on the server in the
   *  lifter's timezone (formatting here would differ between server and
   *  browser and break hydration). */
  evaluatedLabel: string | null;
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

  // Neither call names a rank: the server acts on the verdict it recorded.
  function accept() {
    if (!result?.ok) return;
    startAccept(async () => {
      await acceptTier();
      setResult(null);
    });
  }

  function decline() {
    setResult(null);
    void declineTier().catch(() => undefined);
  }

  const direction =
    result?.ok && current
      ? result.rank > current.rank
        ? "up"
        : result.rank < current.rank
          ? "down"
          : "same"
      : "up";

  const gateCopy = gate.unlimited
    ? "Sends your full training history to DeepSeek for a verdict. You choose whether to accept the result: and past the Monster, you can call for one whenever you like, with nothing new on the log."
    : gate.reason === "no_workout"
      ? "Finish a workout first: the judge rules on logged work, nothing else."
      : gate.reason === "no_new_workout"
        ? "You've already been judged on this record. Log another workout to earn a fresh verdict."
        : gate.reason === "cooldown"
          ? `The judge has ruled. Return in ${
              gate.nextRunAt ? daysUntil(gate.nextRunAt) : EVAL_COOLDOWN_DAYS
            } ${
              gate.nextRunAt && daysUntil(gate.nextRunAt) === 1 ? "day" : "days"
            }: one evaluation every ${EVAL_COOLDOWN_DAYS} days.`
          : "Sends your full training history to DeepSeek for a verdict. You choose whether to accept the result.";

  return (
    <div className="grid gap-4">
      {/* Current rank hero */}
      <div className="rounded-2xl bg-surface p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {current ? `Rank ${current.rank} of ${MAX_RANK}` : "Unranked"}
            {/* Past Julius the judge answers on demand: worth saying out loud,
                it's the reward for clearing the wall. */}
            {gate.unlimited && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                <InfinityIcon className="size-3" />
                Unlimited verdicts
              </span>
            )}
          </div>
          {current ? (
            <>
              <div className="font-display mt-1.5 text-[1.75rem] leading-tight text-text">
                {current.name}
              </div>
              <div className="mt-0.5 text-[15px] text-muted">{current.epithet}</div>
            </>
          ) : (
            <>
              <div className="font-display mt-1.5 text-[1.75rem] leading-tight text-muted">
                No rank yet
              </div>
              <div className="mt-0.5 text-[15px] text-muted">Ask the judge below.</div>
            </>
          )}
          <TierLadder rank={currentRank} className="mt-4" />
          {rationale && (
            <p className="mt-4 text-[15px] leading-[1.5] text-text/80">{rationale}</p>
          )}
          {evaluatedLabel && (
            <p className="mt-2 text-[13px] text-muted">Judged {evaluatedLabel}</p>
          )}
        </div>
      </div>

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
          {pending ? "Judging" : gate.canRun ? "Get judged" : "Judge unavailable"}
        </Button>
        <p className="mt-2 text-[13px] leading-5 text-muted">{gateCopy}</p>
        {gate.canRun && (
          <p className="tnum mt-1 text-[13px] text-muted/70">
            {gate.newWorkouts > 0
              ? `${gate.newWorkouts} new ${gate.newWorkouts === 1 ? "workout" : "workouts"} to judge. `
              : ""}
            {gate.unlimited
              ? "No cooldown at your rank."
              : `One verdict every ${EVAL_COOLDOWN_DAYS} days.`}
          </p>
        )}
      </div>

      {result && !result.ok && (
        <p
          className={cn(
            "rounded-2xl bg-surface p-4 text-[14px]",
            result.error === "not_configured" ? "text-warn" : "text-muted",
          )}
        >
          {result.message}
        </p>
      )}

      {result && result.ok && (
        <div className="rounded-2xl bg-surface-2">
          <div className="p-5">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              Verdict
              {direction === "up" && (
                <span className="inline-flex items-center gap-0.5 text-accent">
                  <ArrowUpRight className="size-3.5" /> promotion
                </span>
              )}
              {direction === "down" && (
                <span className="inline-flex items-center gap-0.5 text-danger">
                  <ArrowDownRight className="size-3.5" /> fallen
                </span>
              )}
              {direction === "same" && (
                <span className="inline-flex items-center gap-0.5 text-muted">
                  <Minus className="size-3.5" /> same rank
                </span>
              )}
            </div>
            <div className="font-display mt-1.5 text-[1.75rem] leading-tight text-text">
              {result.tierName}
            </div>
            <div className="tnum mt-0.5 text-[15px] text-muted">
              {getTier(result.tierKey)?.epithet ? `${getTier(result.tierKey)!.epithet}, ` : ""}
              rank {result.rank} of {MAX_RANK}
            </div>
            <TierLadder rank={result.rank} className="mt-4" />
            <p className="mt-4 text-[15px] leading-[1.5] text-text">{result.rationale}</p>
            {result.highlights.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {result.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13px] text-muted"
                  >
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" />
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
                onClick={decline}
                className="w-full sm:w-auto"
              >
                Keep {current ? current.name : "unranked"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

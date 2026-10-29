"use client";

import { useState } from "react";
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
import { FighterArt } from "@/components/tier/fighter-art";
import { cn } from "@/lib/utils";
import { getTier, MAX_RANK } from "@/lib/tiers";
import { evaluateTier, type EvalResult } from "@/lib/actions/evaluation";
import { acceptTier, declineTier } from "@/lib/actions/profile";
import { useAction } from "@/lib/use-action";
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
  // Guarded: a dropped connection says what didn't happen instead of
  // replacing the page, and the busy state always settles.
  const [pending, start] = useAction("reach the judge");
  const [accepting, startAccept] = useAction("accept the verdict");
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

  // Neither call names a rank: the server acts on the verdict it recorded,
  // and only the one shown here.
  function accept() {
    if (!result?.ok) return;
    const { verdictId } = result;
    startAccept(async () => {
      const accepted = await acceptTier({ verdictId });
      setResult(
        accepted.ok
          ? null
          : {
              ok: false,
              error: "failed",
              message: "That verdict is no longer the judge's latest. Your rank is as it was.",
            },
      );
    });
  }

  function decline() {
    if (!result?.ok) return;
    const { verdictId } = result;
    setResult(null);
    void declineTier({ verdictId }).catch(() => undefined);
  }

  const direction =
    result?.ok && current
      ? result.rank > current.rank
        ? "up"
        : result.rank < current.rank
          ? "down"
          : "same"
      : "up";

  // What actually goes (getTrainingProfile): said plainly, before it goes.
  const sends =
    "The rank is an AI's read of your logged training, not a tested max, and it never goes down. It sends DeepSeek a summary: each lift's bests, how often and how much you train, your program, and your age, sex, height and bodyweight if you've added them. Never your name or email.";
  const gateCopy = gate.unlimited
    ? `${sends} You choose whether to accept the verdict, and past the Monster you can ask whenever you like.`
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
          : `${sends} You choose whether to accept the verdict.`;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* The standing verdict, on the page: the ladder ruled off, then the
          judge's words set as a quote, with when they ruled. */}
      <div className="border-t border-text/[0.12] px-1 pt-4">
        <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted">
          <span className="tnum">
            {current ? `${current.name}, ${currentRank} of ${MAX_RANK}` : "Unranked"}
          </span>
          {/* Past Julius the judge answers on demand: worth saying out loud,
              it's the reward for clearing the wall. */}
          {gate.unlimited && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium">
              <InfinityIcon className="size-3.5" />
              Unlimited verdicts
            </span>
          )}
        </div>
        <TierLadder rank={currentRank} className="mt-2.5 [&>div]:h-1.5" />
        {rationale ? (
          <blockquote className="mt-6 border-l-2 border-accent pl-4">
            <p className="text-[17px] leading-[1.55] text-text/90">{rationale}</p>
            {evaluatedLabel && (
              <footer className="mt-2 text-[13px] text-muted">The judge, {evaluatedLabel}</footer>
            )}
          </blockquote>
        ) : (
          <p className="mt-5 text-[15px] text-muted">No verdict yet. Ask the judge below.</p>
        )}
      </div>

      <div>
        <Button
          onClick={run}
          disabled={pending || !gate.canRun}
          className="px-5"
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
          <p className="tnum mt-1 text-[13px] text-muted">
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
        <div className="hb-plate overflow-hidden rounded-2xl bg-surface-2 [--hb-fade:var(--color-surface-2)]">
          {/* The reveal: the judged fighter pushes in and their name lands
              like a poster, then the reasoning and the choice. */}
          <div className="relative h-64">
            <div className="hb-victory-art absolute inset-0">
              <FighterArt
                fighterKey={getTier(result.tierKey)?.key ?? "ohma"}
                variant="card"
                fade="bottom"
                className="absolute inset-0"
              />
            </div>
            <div className="absolute inset-x-5 bottom-3">
            <div className="flex items-center gap-2 text-[13px] text-text/75">
              Verdict
              {direction === "up" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-accent py-0.5 pl-1.5 pr-2 font-medium text-black">
                  <ArrowUpRight className="size-3.5" /> promotion
                </span>
              )}
              {direction === "down" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-danger py-0.5 pl-1.5 pr-2 font-medium text-black">
                  <ArrowDownRight className="size-3.5" /> fallen
                </span>
              )}
              {direction === "same" && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-text/[0.14] py-0.5 pl-1.5 pr-2 font-medium text-text backdrop-blur-md">
                  <Minus className="size-3.5" /> same rank
                </span>
              )}
            </div>
            <div className="hb-victory-word font-display mt-1.5 text-[2.25rem] leading-[0.95] text-text">
              {result.tierName}
            </div>
            <div className="tnum mt-1 text-[15px] text-text/70">
              {getTier(result.tierKey)?.epithet ? `${getTier(result.tierKey)!.epithet}, ` : ""}
              rank {result.rank} of {MAX_RANK}
            </div>
            </div>
          </div>
          <div className="p-5 pt-4">
            <TierLadder rank={result.rank} />
            <p className="mt-4 text-[15px] leading-[1.5] text-text">{result.rationale}</p>
            {result.highlights.length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-1.5">
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

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TIERS, getTier, MAX_RANK } from "@/lib/tiers";
import { FighterArt } from "@/components/tier/fighter-art";

/**
 * The strength ladder as a list, strongest first, with your rung highlighted
 * and the next one tagged. Rungs you have passed read at full strength; the
 * ones still above you recede. Numbering matches the dashboard ("rank 5 of
 * 10"), counted from the bottom.
 */
export function LadderStanding({ tierKey }: { tierKey: string | null }) {
  const current = getTier(tierKey);
  const rank = current?.rank ?? 0;
  const next = TIERS.find((t) => t.rank === rank + 1) ?? null;
  const ladder = [...TIERS].sort((a, b) => b.rank - a.rank);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-text">The ladder</h2>
        {current ? (
          <span className="tnum text-[13px] text-muted">
            Rank {rank} of {MAX_RANK}
            {next ? `, next ${next.name.split(" ")[0]}` : ""}
          </span>
        ) : (
          <Link href="/settings" className="text-[13px] font-medium text-text hover:opacity-70">
            Get ranked
          </Link>
        )}
      </div>

      <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
        {ladder.map((t) => {
          const isYou = current !== null && t.rank === rank;
          const passed = t.rank < rank;
          const isNext = next?.rank === t.rank;
          return (
            <li
              key={t.key}
              className={cn("flex items-center gap-3 px-3 py-2.5", isYou && "bg-white/[0.06]")}
            >
              <span className="tnum w-5 shrink-0 text-right text-[13px] text-muted/70">{t.rank}</span>
              <FighterArt
                fighterKey={t.key}
                variant="thumbnail"
                className={cn(
                  "size-10 shrink-0 rounded-xl bg-surface-2",
                  !isYou && !passed && "opacity-40 grayscale",
                )}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[15px] font-medium",
                    isYou || passed ? "text-text" : "text-muted",
                  )}
                >
                  {t.name}
                </span>
                <span className="block truncate text-[13px] text-muted/80">{t.epithet}</span>
              </span>
              {isYou && (
                <span className="shrink-0 rounded-full bg-text px-2 py-0.5 text-[11px] font-semibold text-bg">
                  You
                </span>
              )}
              {isNext && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-muted shadow-[inset_0_0_0_1px_var(--color-border)]">
                  Next
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

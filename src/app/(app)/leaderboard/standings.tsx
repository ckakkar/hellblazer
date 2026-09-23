import { Crown } from "lucide-react";
import { FighterArt } from "@/components/tier/fighter-art";
import type { LeaderboardEntry } from "@/lib/data/leaderboard";
import { formatVolume, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * The standings as one list. Place, fighter, ring name and total volume on
 * every row; the leader carries a crown instead of a number, and your own
 * row is lifted out of the list. A table you read down, so nothing animates.
 */
export function Standings({
  entries,
  me,
  unit,
}: {
  entries: LeaderboardEntry[];
  /** Lower-cased username of the signed-in lifter, when they've claimed one. */
  me: string | null;
  unit: Unit;
}) {
  return (
    <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
      {entries.map((e, i) => {
        const mine = me != null && e.username.toLowerCase() === me;
        return (
          <li
            key={`${e.username}-${i}`}
            className={cn("flex items-center gap-3 px-3 py-3", mine && "bg-white/[0.06]")}
          >
            <span className="tnum flex w-6 shrink-0 justify-end text-[13px] text-muted/70">
              {i === 0 ? <Crown className="size-4 text-text" aria-label="First" /> : i + 1}
            </span>
            {e.tierKey ? (
              <FighterArt
                fighterKey={e.tierKey}
                variant="thumbnail"
                className="size-10 shrink-0 rounded-xl bg-surface-2"
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[15px] font-semibold text-muted">
                {e.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-medium text-text">{e.username}</span>
                {mine && (
                  <span className="shrink-0 rounded-full bg-text px-2 py-0.5 text-[11px] font-semibold text-bg">
                    You
                  </span>
                )}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {e.name ? `${e.name}, ${e.epithet}` : "Unranked"}
              </span>
            </span>
            <span className="tnum shrink-0 text-[15px] text-text">
              {formatVolume(e.totalVolumeKg, unit)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

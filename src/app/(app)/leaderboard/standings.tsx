import { Crown } from "lucide-react";
import { FighterArt } from "@/components/tier/fighter-art";
import type { LeaderboardEntry } from "@/lib/data/leaderboard";
import { formatVolume, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * The standings. The top three stand on a podium as their fighters, the
 * leader taller, crowned and ringed in the accent; everyone after is a row
 * with place, fighter, ring name and total volume. Your own entry is marked
 * wherever it lands. The podium rises in once; the list stays still.
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
  const podium = entries.length >= 3 ? entries.slice(0, 3) : [];
  const rest = entries.slice(podium.length);
  const isMe = (e: LeaderboardEntry) =>
    me != null && e.username.toLowerCase() === me;

  return (
    <>
      {podium.length > 0 && (
        <ol
          className="mb-5 grid grid-cols-3 items-end gap-2.5"
          aria-label="Top three"
        >
          {/* Second, first, third: the leader stands in the middle. */}
          {[1, 0, 2].map((i, col) => {
            const e = podium[i];
            const first = i === 0;
            return (
              <li
                key={`${e.username}-${i}`}
                className="hb-hero-rise min-w-0"
                style={{ animationDelay: `${[90, 0, 180][col]}ms`, order: col }}
              >
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-surface [--hb-fade:var(--color-surface)]",
                    first
                      ? "aspect-[3/4.3] ring-1 ring-accent/70 hb-glow"
                      : "aspect-[3/4]",
                  )}
                >
                  {e.tierKey ? (
                    <FighterArt
                      fighterKey={e.tierKey}
                      variant="card"
                      fade="bottom"
                      className="absolute inset-0"
                      imageClassName="object-[center_14%]"
                    />
                  ) : (
                    <span className="font-display absolute inset-0 flex items-center justify-center text-[2.5rem] text-muted/60">
                      {e.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="font-display absolute bottom-2 left-2.5 text-[1.75rem] leading-none text-text">
                    {i + 1}
                  </span>
                  {first && (
                    <Crown
                      className="absolute right-2.5 top-2.5 size-5 text-accent"
                      aria-label="First"
                    />
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-medium text-text">
                    {e.username}
                  </span>
                  {isMe(e) && (
                    <span className="shrink-0 rounded-full bg-text px-1.5 py-px text-[10px] font-semibold text-bg">
                      You
                    </span>
                  )}
                </p>
                <p className="tnum truncate text-[13px] text-muted">
                  {formatVolume(e.totalVolumeKg, unit)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {rest.length > 0 && (
        <ol
          start={podium.length + 1}
          className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface"
        >
          {rest.map((e, j) => {
            const i = j + podium.length;
            const mine = isMe(e);
            return (
              <li
                key={`${e.username}-${i}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  mine && "bg-white/[0.06]",
                )}
              >
                <span className="tnum flex w-6 shrink-0 justify-end text-[13px] text-muted/70">
                  {i === 0 ? (
                    <Crown className="size-4 text-text" aria-label="First" />
                  ) : (
                    i + 1
                  )}
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
                    <span className="truncate text-[15px] font-medium text-text">
                      {e.username}
                    </span>
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
      )}
    </>
  );
}

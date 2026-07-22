import { cn } from "@/lib/utils";
import { TIERS } from "@/lib/tiers";

/** 9-rung strength meter; rungs up to `rank` glow crimson. */
export function TierLadder({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1", className)}>
      {TIERS.map((t) => (
        <div
          key={t.key}
          title={t.name}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            t.rank <= rank ? "bg-accent" : "bg-surface-2",
            t.rank === rank && "shadow-glow",
          )}
        />
      ))}
    </div>
  );
}

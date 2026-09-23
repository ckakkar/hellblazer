import { cn } from "@/lib/utils";
import { TIERS } from "@/lib/tiers";

/** Strength meter: one thin step per tier; steps up to `rank` are filled. */
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
            "h-1 flex-1 rounded-full transition-colors",
            t.rank <= rank ? "bg-accent" : "bg-white/[0.12]",
          )}
        />
      ))}
    </div>
  );
}

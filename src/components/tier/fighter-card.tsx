import { FighterArt } from "@/components/tier/fighter-art";
import type { Tier } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/**
 * A fighter as a card from a fight programme: the portrait on a black plate
 * (in either theme), the rank number in the corner, the name across the
 * foot in the expanded cut, the epithet under it. Sized by its container,
 * so the same card works in a phone's swipe row and a desktop wall.
 */
export function FighterCard({
  tier,
  className,
  imageClassName,
}: {
  tier: Tier;
  className?: string;
  imageClassName?: string;
}) {
  const [first, ...rest] = tier.name.split(" ");
  return (
    <span
      className={cn(
        "hb-plate @container relative isolate block aspect-[3/4] overflow-hidden rounded-2xl bg-surface [--hb-fade:var(--color-surface)]",
        className,
      )}
    >
      <FighterArt
        fighterKey={tier.key}
        variant="card"
        fade="bottom"
        className="absolute inset-0 -z-10"
        imageClassName={imageClassName}
      />
      {/* A little shade in the corner, so the numeral reads over hair. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-[5]"
        style={{ background: "radial-gradient(60% 40% at 0% 0%, rgb(0 0 0 / 0.55), transparent 70%)" }}
      />
      <span className="tnum font-display absolute left-3 top-2.5 text-[clamp(1.375rem,20cqw,2.25rem)] leading-none text-text/90">
        {tier.rank}
      </span>
      <span className="absolute inset-x-3 bottom-3">
        <span className="font-display block text-[clamp(0.9375rem,11.5cqw,1.375rem)] leading-[0.95] text-text">
          {first}
          {rest.length > 0 && (
            <>
              <br />
              {rest.join(" ")}
            </>
          )}
        </span>
        <span className="mt-1.5 block truncate text-[12px] text-text/70">{tier.epithet}</span>
      </span>
    </span>
  );
}

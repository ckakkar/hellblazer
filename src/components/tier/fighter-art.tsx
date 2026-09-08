import Image from "next/image";
import { FIGHTER_ART } from "@/lib/fighter-art";
import type { TierKey } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export type FighterArtVariant = "hero" | "card" | "thumbnail";

type FighterArtProps = {
  fighterKey?: TierKey;
  variant?: FighterArtVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Decorative by default: the surrounding copy names the role of the art. */
  alt?: string;
};

/** Canon-based Kengan portrait, finished in Hell Blazer's fight-poster style. */
export function FighterArt({
  fighterKey = "ohma",
  variant = "card",
  className,
  imageClassName,
  priority = false,
  alt = "",
}: FighterArtProps) {
  const art = FIGHTER_ART[fighterKey];
  const sizes =
    variant === "thumbnail"
      ? "56px"
      : variant === "hero"
        ? "(max-width: 768px) 100vw, 640px"
        : "(max-width: 768px) 72vw, 420px";

  return (
    <figure
      className={cn("pointer-events-none relative isolate overflow-hidden", className)}
      data-variant={variant}
      aria-hidden={alt ? undefined : true}
    >
      {variant !== "thumbnail" && (
        <div className="hb-fighter-aura absolute inset-[12%_5%_4%_18%] -z-10" />
      )}
      {variant === "thumbnail" ? (
        <Image
          src={art.src}
          alt={alt}
          width={112}
          height={112}
          loading="lazy"
          placeholder="blur"
          sizes={sizes}
          className={cn(
            "h-full w-full object-cover object-center contrast-[1.05]",
            imageClassName,
          )}
        />
      ) : (
        <Image
          src={art.src}
          alt={alt}
          width={art.src.width}
          height={art.src.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          placeholder="blur"
          sizes={sizes}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center contrast-[1.05] drop-shadow-[0_28px_42px_rgba(0,0,0,0.8)]",
            imageClassName,
          )}
        />
      )}
      {variant !== "thumbnail" && (
        <div className="hb-portrait-fade absolute inset-0" />
      )}
    </figure>
  );
}

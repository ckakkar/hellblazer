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
  /** "corner" fades the left and bottom edges (art beside text); "bottom"
   *  fades only the bottom (full-bleed art with text below it). */
  fade?: "corner" | "bottom";
};

/**
 * Canon-based Kengan portrait. Non-thumbnail variants fade into whatever they
 * sit on: set `--hb-fade` on an ancestor to that surface's colour (it
 * defaults to the page black).
 */
export function FighterArt({
  fighterKey = "ohma",
  variant = "card",
  className,
  imageClassName,
  priority = false,
  alt = "",
  fade = "corner",
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
            "absolute inset-0 h-full w-full object-cover object-center contrast-[1.05]",
            imageClassName,
          )}
        />
      )}
      {variant !== "thumbnail" && (
        <div
          className="absolute inset-0"
          style={{
            background:
              fade === "bottom"
                ? "linear-gradient(to top, var(--hb-fade, var(--color-bg)) 0%, transparent 55%)"
                : "linear-gradient(to right, var(--hb-fade, var(--color-bg)) 0%, transparent 42%), linear-gradient(to top, var(--hb-fade, var(--color-bg)) 0%, transparent 34%)",
          }}
        />
      )}
    </figure>
  );
}

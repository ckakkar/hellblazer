"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The account picture, with the lifter's initial as a fallback. Google avatar
 * URLs do expire, and a broken-image glyph at the top of the profile is worse
 * than no picture at all, so a load failure falls back to the initial rather
 * than rendering the browser's placeholder.
 *
 * Client-only for the sake of `onError`; the rest of the header stays a server
 * component.
 */
export function ProfileAvatar({
  src,
  initial,
  className,
}: {
  src: string | null;
  initial: string;
  /** Size and ring; defaults to 64px. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-2xl text-muted",
          className,
        )}
      >
        {initial}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={96}
      height={96}
      unoptimized
      onError={() => setFailed(true)}
      className={cn("size-16 shrink-0 rounded-full object-cover", className)}
    />
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The account picture, with the lifter's initial as a fallback. Google avatar
 * URLs do expire, and a broken-image glyph at the top of the profile is worse
 * than no picture at all — so a load failure falls back to the initial rather
 * than rendering the browser's placeholder.
 *
 * Client-only for the sake of `onError`; the rest of the header stays a server
 * component.
 */
export function ProfileAvatar({
  src,
  initial,
}: {
  src: string | null;
  initial: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-impact text-2xl text-muted">
        {initial}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={64}
      height={64}
      unoptimized
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-full border border-border object-cover"
    />
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE_NAME } from "@/lib/local-date";

function readCookie(name: string): string | null {
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/**
 * Hands the browser's timezone to the server. Server renders work out "today"
 * and "this week" from it; before the cookie exists they fall back to an IP
 * guess or UTC, so when the server guessed wrong, store the real zone and
 * re-render once.
 */
export function TimezoneSync({ serverTimeZone }: { serverTimeZone: string }) {
  const router = useRouter();

  useEffect(() => {
    let timeZone: string | undefined;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!timeZone || timeZone === serverTimeZone) return;
    // Already sent and the server still chose another zone (it didn't
    // recognise this one): refreshing again would loop.
    if (readCookie(TZ_COOKIE_NAME) === timeZone) return;
    document.cookie = `${TZ_COOKIE_NAME}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [serverTimeZone, router]);

  return null;
}

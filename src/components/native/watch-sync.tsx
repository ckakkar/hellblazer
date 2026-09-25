"use client";

import { useEffect } from "react";
import { linkWatch } from "@/lib/actions/watch";
import { withNative } from "@/lib/native-plugins";
import { savedRestSeconds } from "@/lib/rest-timer";
import type { Unit } from "@/lib/units";

/**
 * iOS app only, in the signed-in layout: keeps a paired Apple Watch in step
 * with this lifter. The first time (or after a different lifter signs in)
 * it links the watch: a token the watch uses for /api/watch, handed over by
 * the phone. Every visit it also passes along the unit, accent, rest length
 * and timezone. Renders nothing, and does nothing on the website.
 */
export function WatchSync({ userId, unit, accent }: { userId: string; unit: Unit; accent: string }) {
  useEffect(() => {
    withNative(async (api) => {
      const status = await api.watchStatus();
      if (!status.paired || status.disabled) return;
      const token = status.linkedUserId === userId ? undefined : (await linkWatch()).token;
      await api.watchSync({
        token,
        userId,
        unit,
        accent,
        restSeconds: savedRestSeconds(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    });
  }, [userId, unit, accent]);
  return null;
}

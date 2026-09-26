"use client";

import { useEffect } from "react";
import { linkPhone, linkWatch } from "@/lib/actions/watch";
import { withNative } from "@/lib/native-plugins";
import { savedRestSeconds } from "@/lib/rest-timer";
import type { Unit } from "@/lib/units";

/**
 * iOS app only, in the signed-in layout: keeps this iPhone and a paired Apple
 * Watch in step with the lifter. The first time (or after someone else signs
 * in) it links each: a device token for the phone, so a silent push can have
 * it refresh the widgets on its own, and one the watch uses for /api/watch.
 * Every visit it also passes along the unit, accent, rest length and
 * timezone. Renders nothing, and does nothing on the website.
 */
export function DeviceSync({ userId, unit, accent }: { userId: string; unit: Unit; accent: string }) {
  useEffect(() => {
    withNative(async (api) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const phone = await api.phoneStatus();
      const phoneToken = phone.linkedUserId === userId ? undefined : (await linkPhone()).token;
      await api.phoneSync({ token: phoneToken, userId, unit, timeZone });

      const watch = await api.watchStatus();
      if (!watch.paired || watch.disabled) return;
      const watchToken = watch.linkedUserId === userId ? undefined : (await linkWatch()).token;
      await api.watchSync({
        token: watchToken,
        userId,
        unit,
        accent,
        restSeconds: savedRestSeconds(),
        timeZone,
      });
    });
  }, [userId, unit, accent]);
  return null;
}

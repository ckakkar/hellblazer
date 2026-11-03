"use client";

import { useEffect } from "react";
import { linkPhone, linkWatch, unlinkWatch } from "@/lib/actions/watch";
import { accountEpoch } from "@/lib/account-epoch";
import { healthSyncOn, withNative } from "@/lib/native-plugins";
import { savedRestAuto, savedRestSeconds } from "@/lib/rest-timer";
import { hrRestOn } from "@/lib/watch-prefs";
import type { Unit } from "@/lib/units";

/**
 * iOS app only, in the signed-in layout: keeps this iPhone and a paired Apple
 * Watch in step with the lifter. The first time (or after someone else signs
 * in) it links each: a device token for the phone, so a silent push can have
 * it refresh the widgets on its own, and one the watch uses for /api/watch.
 * Every visit it also passes along the unit, accent, rest settings and
 * timezone. Renders nothing, and does nothing on the website.
 *
 * Nothing it fetched is handed to the phone once this lifter has signed out
 * (or the page moved on): a token minted for them that lands late is revoked
 * instead, so it can't link the phone or watch back to them over whoever's
 * signed in now.
 */
export function DeviceSync({ userId, unit, accent }: { userId: string; unit: Unit; accent: string }) {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let live = true;
    const epoch = accountEpoch();
    const current = () => live && accountEpoch() === epoch;
    const drop = (token: string | undefined) => {
      if (token) void unlinkWatch({ token }).catch(() => undefined);
    };
    // Separately, so one failing (an older app without the phone's methods,
    // say) can't stop the other.
    withNative(async (api) => {
      const phone = await api.phoneStatus();
      if (!current()) return;
      const phoneToken = phone.linkedUserId === userId ? undefined : (await linkPhone()).token;
      if (!current()) return drop(phoneToken);
      await api.phoneSync({ token: phoneToken, userId, unit, timeZone });
    });
    // For sets said to Siri while no workout page is awake to start the rest,
    // and a workout finished by voice, which the app saves to Health itself.
    withNative((api) => api.setRestDefaults({ seconds: savedRestSeconds(), auto: savedRestAuto() }));
    withNative((api) => api.setHealthSync({ on: healthSyncOn() }));
    withNative(async (api) => {
      const watch = await api.watchStatus();
      if (!watch.paired || watch.disabled || !current()) return;
      const watchToken = watch.linkedUserId === userId ? undefined : (await linkWatch()).token;
      if (!current()) return drop(watchToken);
      await api.watchSync({
        token: watchToken,
        userId,
        unit,
        accent,
        restSeconds: savedRestSeconds(),
        hrRest: hrRestOn(),
        timeZone,
      });
    });
    return () => {
      live = false;
    };
  }, [userId, unit, accent]);
  return null;
}

import { isNativeApp } from "@/lib/native";

export type HapticCue = "record" | "rest-done";

/** Web Vibration API patterns (Android browsers; iOS Safari ignores them). */
const WEB_PATTERN: Record<HapticCue, number[]> = {
  record: [30, 50, 90],
  "rest-done": [120, 70, 180],
};

/**
 * A physical cue for moments that matter: a new record, the end of a rest.
 * In the iOS app it's a Taptic Engine notification; on the web it's the
 * vibration pattern the site has always used.
 */
export function haptic(cue: HapticCue) {
  if (isNativeApp()) {
    void import("@capacitor/haptics")
      .then(({ Haptics, NotificationType }) =>
        Haptics.notification({
          type: cue === "record" ? NotificationType.Success : NotificationType.Warning,
        }),
      )
      .catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(WEB_PATTERN[cue]);
  }
}

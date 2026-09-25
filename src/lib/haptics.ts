import { isNativeApp } from "@/lib/native";

/**
 * - `record`: a new personal best.
 * - `rest-done`: the rest is over.
 * - `success`: something big went through (a workout finished).
 * - `warning`: a destructive hold completed (delete, wipe).
 * - `tap`: a set landed, a rest started. A light knock.
 * - `tick`: a value stepped or a switch flipped, like a picker's detent.
 */
export type HapticCue = "record" | "rest-done" | "success" | "warning" | "tap" | "tick";

/** Capacitor's selection haptic only fires after selectionStart(). */
let selectionPrimed = false;

/** Web Vibration API patterns (Android browsers; iOS Safari ignores them). */
const WEB_PATTERN: Partial<Record<HapticCue, number[]>> = {
  record: [30, 50, 90],
  "rest-done": [120, 70, 180],
};

/**
 * A physical cue. In the iOS app it's the Taptic Engine, with the same
 * vocabulary as system controls; on the web only the two big moments (a
 * record, the end of a rest) vibrate, as the site always has.
 */
export function haptic(cue: HapticCue) {
  if (isNativeApp()) {
    void import("@capacitor/haptics")
      .then(({ Haptics, ImpactStyle, NotificationType }) => {
        switch (cue) {
          case "tick":
            if (!selectionPrimed) {
              selectionPrimed = true;
              return Haptics.selectionStart().then(() => Haptics.selectionChanged());
            }
            return Haptics.selectionChanged();
          case "tap":
            return Haptics.impact({ style: ImpactStyle.Light });
          case "warning":
            return Haptics.notification({ type: NotificationType.Warning });
          case "rest-done":
            return Haptics.notification({ type: NotificationType.Warning });
          case "record":
          case "success":
            return Haptics.notification({ type: NotificationType.Success });
        }
      })
      .catch(() => {});
    return;
  }
  const pattern = WEB_PATTERN[cue];
  if (pattern && typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

import { useSyncExternalStore } from "react";

/**
 * An iPad, in the app or in Safari. Safari on an iPad asks for desktop sites
 * and reports itself as a Mac; its touch screen gives it away.
 */
export function isIPad(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /\biPad\b/.test(ua) || (/\bMacintosh\b/.test(ua) && navigator.maxTouchPoints > 1);
}

/** An iPhone, iPod or iPad. */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /\biP(hone|od)\b/.test(navigator.userAgent) || isIPad();
}

export type DeviceName = "iPhone" | "iPad";

/** For copy such as "stays on this iPhone", outside React. */
export function deviceName(): DeviceName {
  return isIPad() ? "iPad" : "iPhone";
}

const never = () => () => {};

/** {@link deviceName} for a render: iPhone on the server and the first paint. */
export function useDeviceName(): DeviceName {
  return useSyncExternalStore(never, deviceName, () => "iPhone");
}

export const DEFAULT_REST_SECONDS = 90;
export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;

export function clampRestDuration(seconds: number) {
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, seconds));
}

export function formatRestClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Where the rest timer keeps its default length (seconds), per device. */
export const REST_SECONDS_KEY = "hell-blazer:rest-seconds";

/** The saved default rest, for the Apple Watch; the default when unset. */
export function savedRestSeconds(): number {
  try {
    const saved = Number(window.localStorage.getItem(REST_SECONDS_KEY));
    return Number.isFinite(saved) && saved >= MIN_REST_SECONDS && saved <= MAX_REST_SECONDS
      ? saved
      : DEFAULT_REST_SECONDS;
  } catch {
    return DEFAULT_REST_SECONDS;
  }
}

/** Past this, the clock is measuring a session left open, not a workout. */
export const STALE_CLOCK_MS = 6 * 60 * 60 * 1000;

/** Elapsed milliseconds → clock string: M:SS, then "1h 05m" past an hour
 *  (seconds stop mattering, and H:MM:SS won't fit the readout on a small
 *  phone). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}h ${mm}m` : `${m}:${ss}`;
}

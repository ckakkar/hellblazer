import type { HellBlazerNative } from "@/lib/native-plugins";

/**
 * Finished workouts Apple Health didn't take (no permission at the time, or
 * the save failed), kept on the phone and offered again whenever the app
 * comes forward, for a week. One the watch recorded is never retried: it's
 * in Health already, with its heart rate.
 */

export type HealthSave = { sessionId: string; start: number; end: number; effort?: number };
type Kept = HealthSave & { at: number };

const KEY = "hb:health-retry";
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function read(): Kept[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Kept[];
    return Array.isArray(list) ? list.filter((k) => Date.now() - k.at < KEEP_MS) : [];
  } catch {
    return [];
  }
}

function write(list: Kept[]) {
  try {
    if (list.length > 0) window.localStorage.setItem(KEY, JSON.stringify(list.slice(-10)));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to retry from.
  }
}

/** Saves to Health; resolves to whether it's there (or on the watch's copy). Kept to retry if not. */
export async function saveToHealthOrKeep(api: HellBlazerNative, save: HealthSave): Promise<boolean> {
  try {
    const r = (await api.saveWorkout(save)) as { saved: boolean; skipped?: string };
    if (r.saved || r.skipped) return true;
  } catch {
    // Kept below.
  }
  write([...read().filter((k) => k.sessionId !== save.sessionId), { ...save, at: Date.now() }]);
  return false;
}

/** Offers Health the workouts it didn't take before. */
export async function retryHealthSaves(api: HellBlazerNative): Promise<void> {
  const kept = read();
  if (kept.length === 0) return;
  const left: Kept[] = [];
  for (const k of kept) {
    try {
      const r = (await api.saveWorkout({ sessionId: k.sessionId, start: k.start, end: k.end, effort: k.effort })) as {
        saved: boolean;
        skipped?: string;
      };
      if (!r.saved && !r.skipped) left.push(k);
    } catch {
      left.push(k);
    }
  }
  write(left);
}

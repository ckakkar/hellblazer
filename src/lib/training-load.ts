import { STALE_CLOCK_MS } from "@/lib/workout-clock";

/**
 * What the lifter's own training says about today, for Recovery: when the
 * last heavy session was, how the last three days compare with their usual,
 * and how many days running they've trained. From the workouts Fatty logged,
 * computed on the server (getTrainingLoad) and handed to the card, which
 * passes it on to the app so the widget and the watch weigh it too.
 */

export type TrainingLoad = {
  /** The most recent heavy session: one that moved well over the lifter's usual. */
  lastHeavy: { at: number; title: string; sets: number } | null;
  /** Working sets in the last 72 hours. */
  recentSets: number;
  /** The usual for 72 hours, from the four weeks before them; null with too few sessions to say. */
  usualSets: number | null;
  /** Days in a row with a workout, ending today or yesterday. */
  streakDays: number;
};

export type LoadSession = {
  /** When it ended (finished, else started), epoch ms. */
  at: number;
  /** yyyy-MM-dd in the lifter's calendar. */
  date: string;
  title: string;
  sets: number;
  volume: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * A session is heavy when it moved at least 10% more than the lifter's
 * median session over the window, with eight working sets or more, so a
 * long accessory day doesn't count and neither does a quick top-up. With
 * under four sessions to compare, twelve working sets is heavy.
 */
export function isHeavy(s: LoadSession, all: LoadSession[]): boolean {
  if (s.sets < 8) return false;
  const others = all.filter((o) => o.sets > 0);
  if (others.length < 4) return s.sets >= 12;
  const usual = median(others.map((o) => o.volume)) ?? 0;
  return usual > 0 && s.volume >= usual * 1.1;
}

/** `sessions`: the last five weeks of finished workouts with sets in them. */
export function computeTrainingLoad(sessions: LoadSession[], now: number, today: string): TrainingLoad {
  const done = sessions.filter((s) => s.sets > 0 && s.at <= now);
  const heavy = done.filter((s) => isHeavy(s, done)).sort((a, b) => b.at - a.at)[0];

  const recentSets = done.filter((s) => now - s.at < 3 * DAY).reduce((n, s) => n + s.sets, 0);
  const before = done.filter((s) => now - s.at >= 3 * DAY && now - s.at < 31 * DAY);
  const usualSets = before.length >= 4 ? (before.reduce((n, s) => n + s.sets, 0) / 28) * 3 : null;

  // Back from today (or yesterday, if today's not trained yet) day by day.
  const dates = new Set(done.map((s) => s.date));
  const dayBefore = (d: string) => {
    const t = new Date(`${d}T12:00:00Z`).getTime() - DAY;
    return new Date(t).toISOString().slice(0, 10);
  };
  let day = dates.has(today) ? today : dayBefore(today);
  let streakDays = 0;
  while (dates.has(day)) {
    streakDays++;
    day = dayBefore(day);
  }

  return {
    lastHeavy: heavy ? { at: heavy.at, title: heavy.title, sets: heavy.sets } : null,
    recentSets,
    usualSets: usualSets === null ? null : Math.round(usualSets * 10) / 10,
    streakDays,
  };
}

/**
 * From History's rows (v_session_summary): the workouts of the last five
 * weeks that are over (finished, or left open past the stale clock), so the
 * one under way doesn't count yet.
 */
export function trainingLoadFromSummaries(
  rows: {
    session_date: string | null;
    created_at: string | null;
    finished_at: string | null;
    duration_min: number | null;
    title: string | null;
    working_sets: number | null;
    total_volume: number | null;
  }[],
  today: string,
  now = Date.now(),
): TrainingLoad {
  const sessions: LoadSession[] = rows.flatMap((r) => {
    if (!r.session_date || !r.created_at || !(Number(r.working_sets) > 0)) return [];
    const started = Date.parse(r.created_at);
    if (!r.finished_at && now - started < STALE_CLOCK_MS) return [];
    const at = r.finished_at ? Date.parse(r.finished_at) : started + (r.duration_min ?? 60) * 60_000;
    if (now - at > 35 * DAY) return [];
    return [{ at, date: r.session_date, title: r.title ?? "Workout", sets: Number(r.working_sets), volume: Number(r.total_volume ?? 0) }];
  });
  return computeTrainingLoad(sessions, now, today);
}

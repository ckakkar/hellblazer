import { describe, expect, it } from "vitest";
import {
  analyzeHeart,
  estimatedMaxHr,
  heartFacts,
  heartTemplate,
  usualOf,
  type HeartSample,
  type TimedSet,
} from "@/lib/heart-insights";

const T0 = Date.parse("2026-09-28T09:00:00Z");
const MIN = 60_000;

/**
 * A made-up workout trace: 90 bpm between sets; each set climbs for the
 * 40s before it's logged, peaks 15s after, then eases off over a couple of
 * minutes, as a wrist sensor sees it.
 */
function trace(minutes: number, sets: { at: number; amp: number }[], base = 90): HeartSample[] {
  const out: HeartSample[] = [];
  for (let t = T0; t <= T0 + minutes * MIN; t += 5_000) {
    let bpm = base;
    for (const s of sets) {
      const dt = (t - s.at) / 1000;
      if (dt >= -40 && dt <= 15) bpm = Math.max(bpm, base + (s.amp * (dt + 40)) / 55);
      else if (dt > 15) bpm = Math.max(bpm, base + s.amp * Math.exp(-(dt - 15) / 45));
    }
    out.push({ t, bpm: Math.round(bpm) });
  }
  return out;
}

const set = (minute: number, key: string, exercise: string, warmup = false): TimedSet => ({
  at: T0 + minute * MIN,
  key,
  exercise,
  warmup,
});

const window = { start: T0, end: T0 + 30 * MIN, resting: 55, maxHr: 185 };

describe("analyzeHeart", () => {
  const sets = [
    set(3, "sq", "Squat"),
    set(6, "sq", "Squat"),
    set(9, "sq", "Squat"),
    set(14, "cu", "Barbell Curl"),
    set(15.2, "cu", "Barbell Curl"),
    set(20, "cu", "Barbell Curl"),
  ];
  const samples = trace(30, [
    ...sets.slice(0, 3).map((s) => ({ at: s.at, amp: 80 })),
    ...sets.slice(3).map((s) => ({ at: s.at, amp: 40 })),
  ]);

  it("finds the exercise that pushed hardest, peaking just after its sets", () => {
    const h = analyzeHeart(samples, sets, window)!;
    expect(h.exercises.map((e) => [e.name, e.sets])).toEqual([
      ["Squat", 3],
      ["Barbell Curl", 3],
    ]);
    // The trace tops out at 170 for one reading; smoothing takes it to its neighbours.
    expect(h.exercises[0].peak).toBeGreaterThanOrEqual(160);
    expect(h.exercises[1].peak).toBeLessThan(132);
    expect(h.marks[0].peakAt - h.marks[0].at).toBeGreaterThan(0);
    expect(h.peak).toBe(h.exercises[0].peak);
  });

  it("measures a minute's recovery only when the rest ran that long", () => {
    const h = analyzeHeart(samples, sets, window)!;
    // Every rest but the 72s one between the curls, and none after the last set
    // runs out of trace... the last set's minute is inside the workout, so it counts.
    expect(h.recoveries).toBe(5);
    expect(h.recovery).toBeGreaterThan(20);
  });

  it("counts a set started before the heart rate came back down", () => {
    const h = analyzeHeart(samples, sets, window)!;
    expect(h.restsJudged).toBe(5);
    expect(h.shortRests).toBe(1);
  });

  it("can't place sets logged in one go, and skips warm-ups", () => {
    const bulk = [set(3, "sq", "Squat", true), set(6, "sq", "Squat"), set(6.1, "sq", "Squat"), set(6.2, "sq", "Squat")];
    const h = analyzeHeart(samples, bulk, window)!;
    expect(h.marks).toHaveLength(1);
    expect(h.exercises[0].sets).toBe(1);
  });

  it("adds up time in each zone and the load from it", () => {
    const h = analyzeHeart(samples, sets, window)!;
    const total = h.zones.reduce((n, m) => n + m, 0);
    // 90 bpm of a 185 max is under half: the quiet stretches count for nothing.
    expect(total).toBeGreaterThan(5);
    expect(total).toBeLessThan(30);
    expect(h.zones[0]).toBeGreaterThan(0);
    expect(h.load).toBe(Math.round(h.zones.reduce((n, m, i) => n + m * (i + 1), 0)));
  });

  it("says nothing without a watch-recorded workout's worth of readings", () => {
    const sparse = trace(30, []).filter((_, i) => i % 12 === 0);
    expect(analyzeHeart(sparse, sets, window)).toBeNull();
  });

  it("smooths away a single jumpy reading", () => {
    const spiky = trace(30, []).map((s, i) => (i === 100 ? { ...s, bpm: 200 } : s));
    expect(analyzeHeart(spiky, [], window)!.peak).toBe(90);
  });
});

describe("estimatedMaxHr", () => {
  it("is 208 - 0.7 × age, when there's an age", () => {
    expect(estimatedMaxHr(30)).toBe(187);
    expect(estimatedMaxHr(null)).toBeNull();
  });
});

describe("usualOf", () => {
  it("needs three sessions, and takes the median of the last eight", () => {
    expect(usualOf([{ recovery: 30, load: 100 }, { recovery: 40, load: 120 }])).toEqual({ recovery: null, load: null });
    expect(
      usualOf([
        { recovery: 10, load: 50 },
        { recovery: 30, load: 100 },
        { recovery: null, load: 140 },
        { recovery: 26, load: 120 },
      ]),
    ).toEqual({ recovery: 26, load: 110 });
  });
});

describe("the words", () => {
  const sets = [set(3, "sq", "Squat"), set(7, "sq", "Squat")];
  const h = analyzeHeart(trace(30, sets.map((s) => ({ at: s.at, amp: 80 }))), sets, window)!;

  it("lists the facts for the model, with the usual when known", () => {
    const facts = heartFacts(h, { recovery: 30, load: 90 });
    expect(facts[0]).toBe(`Hardest exercise: Squat, heart rate peaking at ${h.exercises[0].peak} bpm.`);
    expect(facts.join(" ")).toContain("(usually 30 bpm)");
    expect(facts.join(" ")).toContain(`Training load: ${h.load} (usually 90).`);
    expect(facts.join(" ")).toContain("Rests: every set started after heart rate had come back down.");
  });

  it("falls back to a plain summary", () => {
    expect(heartTemplate(h, { recovery: 99, load: null })).toBe(
      `Squat pushed you hardest, peaking at ${h.exercises[0].peak} bpm. It came down ${h.recovery} bpm a minute into your rests, slower than usual.`,
    );
  });
});

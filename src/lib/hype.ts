// Kengan-grade hype lines shown mid-session. Kept punchy and on-theme.
export const HYPE_LINES = [
  "Pain is just data. Log it.",
  "The set doesn't count until it's recorded.",
  "Weakness is a choice. Not today.",
  "Every rep is a strike thrown in the ring.",
  "The strongest are the most obsessed.",
  "Leave nothing on the arena floor.",
  "One more. Always one more.",
  "Advance. Then advance again.",
  "Numbers don't lie. Make them climb.",
  "This is the Kengan match. Perform.",
];

export const VICTORY_LINES = [
  "VICTORY",
  "REMOVAL",
  "MATCH WON",
  "CRUSHED IT",
  "DOMINATED",
];

export function randomHype(): string {
  return HYPE_LINES[Math.floor(Math.random() * HYPE_LINES.length)];
}

/** Deterministic pick from a seed (e.g. session id) — stable across SSR/CSR. */
export function pickHype(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HYPE_LINES[h % HYPE_LINES.length];
}

export function randomVictory(): string {
  return VICTORY_LINES[Math.floor(Math.random() * VICTORY_LINES.length)];
}

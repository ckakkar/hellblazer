/**
 * Lift notes the server doesn't have yet, kept on the device per account
 * (exercise id → the note, or null for one removed), so one that didn't
 * save survives leaving the page, a reload, or the app being closed: the
 * next page that shows notes puts it back and sends it again. Like queued
 * sets, they're only ever sent for the account that wrote them; signed out
 * or switched, they wait. Storage that's blocked keeps nothing (the page
 * still says the note didn't save while it's open).
 *
 * Each kept copy has a stamp, and the server's answer to a send clears only
 * the copy that send carried: "A, then B, then A again" can't have the
 * first A's answer clear the last A while that one's still on its way.
 */
export type UnsentNotes = Record<string, string | null>;
type Kept = Record<string, { note: string | null; at: number }>;

const key = (userId: string) => `hb_unsent_notes:${userId}`;

let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

function readKept(userId: string): Kept {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key(userId)) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Kept = {};
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      const kept = v as { note?: unknown; at?: unknown } | null;
      if (!kept || typeof kept !== "object" || typeof kept.at !== "number") continue;
      if (typeof kept.note === "string" || kept.note === null) out[id] = { note: kept.note, at: kept.at };
    }
    return out;
  } catch {
    return {};
  }
}

function write(userId: string, kept: Kept) {
  try {
    if (Object.keys(kept).length > 0) window.localStorage.setItem(key(userId), JSON.stringify(kept));
    else window.localStorage.removeItem(key(userId));
  } catch {
    // Storage blocked: nothing kept beyond the page.
  }
}

/** The notes kept for this account, to show and send again. */
export function readUnsentNotes(userId: string): UnsentNotes {
  return Object.fromEntries(Object.entries(readKept(userId)).map(([id, k]) => [id, k.note]));
}

/** Keeps a note (null: its removal) until the server has it; returns its stamp. */
export function keepUnsentNote(userId: string, exerciseId: string, note: string | null): number {
  const at = stamp();
  write(userId, { ...readKept(userId), [exerciseId]: { note, at } });
  return at;
}

/** The server has the copy stamped `at`: cleared, unless a newer one is kept since. */
export function dropUnsentNote(userId: string, exerciseId: string, at: number) {
  const kept = readKept(userId);
  if (kept[exerciseId]?.at !== at) return;
  delete kept[exerciseId];
  write(userId, kept);
}

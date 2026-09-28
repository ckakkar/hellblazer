/**
 * Supersets: exercises done back to back, resting only after the round.
 * Each exercise may carry a group number; consecutive exercises sharing one
 * are a superset (a lone one is just an exercise), labelled as programs
 * write them: A1, A2, then B1, B2 for the next. Reordering can only ever
 * split a group, never mix two.
 */

export type SupersetSlot = {
  /** "A", "B"… in the order the supersets come. */
  letter: string;
  /** 1-based place in its superset. */
  slot: number;
  /** Indexes of the superset's exercises, in order. */
  members: number[];
};

/** Each row's superset slot, or null for one on its own. */
export function supersetSlots<T>(rows: T[], groupOf: (row: T) => number | null | undefined): (SupersetSlot | null)[] {
  const slots: (SupersetSlot | null)[] = rows.map(() => null);
  let letter = 0;
  let i = 0;
  while (i < rows.length) {
    const group = groupOf(rows[i]);
    let j = i + 1;
    if (group != null) {
      while (j < rows.length && groupOf(rows[j]) === group) j++;
    }
    if (group != null && j - i >= 2) {
      const members = Array.from({ length: j - i }, (_, k) => i + k);
      const name = String.fromCharCode(65 + (letter++ % 26));
      members.forEach((m, k) => (slots[m] = { letter: name, slot: k + 1, members }));
    }
    i = j;
  }
  return slots;
}

/** "A1". */
export function slotLabel(slot: SupersetSlot): string {
  return `${slot.letter}${slot.slot}`;
}

/**
 * The group number that links exercise `i` with the one after it: its own
 * if it has one, the next one's if that has one, else a number no row uses.
 */
export function linkGroup(groups: (number | null | undefined)[], i: number): number {
  const own = groups[i] ?? groups[i + 1];
  if (own != null) return own;
  const used = new Set(groups.filter((g): g is number => g != null));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/**
 * The group numbers to write when exercise `i` (rows in order) joins the
 * one after it in a superset (`link`), or leaves its superset. Only the
 * rows that change.
 */
export function supersetChanges<R extends { id: string; superset: number | null }>(
  rows: R[],
  i: number,
  link: boolean,
): { id: string; superset: number | null }[] {
  const row = rows[i];
  if (!row) return [];
  if (!link) return row.superset == null ? [] : [{ id: row.id, superset: null }];
  const next = rows[i + 1];
  if (!next) return [];
  const group = linkGroup(
    rows.map((r) => r.superset),
    i,
  );
  return [row, next].filter((r) => r.superset !== group).map((r) => ({ id: r.id, superset: group }));
}

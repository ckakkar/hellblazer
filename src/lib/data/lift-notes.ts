import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Exercise id to the lifter's own note on it ("Seat 4, pin 7"). */
export type LiftNotes = Record<string, string>;

/**
 * Every note the lifter keeps on a movement (`exercise_note`, at most one per
 * exercise, so a few dozen rows). Read whole, so an exercise added or swapped
 * in mid-workout already has its note. A note is a help, not the page: if the
 * read fails the page still renders, without notes.
 */
export async function getLiftNotes(): Promise<LiftNotes> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercise_note").select("exercise_id, note");
  if (error) {
    console.error("lift notes read failed", error.code);
    return {};
  }
  return Object.fromEntries((data ?? []).map((r) => [r.exercise_id, r.note]));
}

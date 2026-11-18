"use client";

import { createClient, createClientAs } from "@/lib/supabase/client";
import {
  SESSION_SETS_SELECT,
  setRow,
  setWriteSchema,
  toSessionSets,
  type SessionSets,
  type SetWrite,
} from "@/lib/set-write";

/**
 * The logger's own traffic, straight to the database with the lifter's
 * session (row-level security holds it to their rows, as it does a server
 * action's): saving and deleting sets, "done with this one", and reading
 * what another device did. Not server actions, because Next sends those
 * one at a time per page: one request stuck on a gym's dead connection
 * held every save behind it, and the logger's own reads queued with them.
 *
 * Each request gives up after a while, so a hung connection turns into a
 * failure the logger retries, not a spinner. Writes to one row still land
 * in the order they were made (`inOrder`): a set saved and then cleared
 * can't be deleted first and saved after.
 */

const TIMEOUT_MS = 12_000;

const chains = new Map<string, Promise<unknown>>();

/** Runs `work` once everything sent earlier for `key` has settled. */
function inOrder<T>(key: string, work: () => Promise<T>): Promise<T> {
  const before = chains.get(key) ?? Promise.resolve();
  const run = before.then(work, work);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, settled);
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return run;
}

/** How long a logger write of a set waits for an outbox upload of it. */
export const OUTBOX_HOLD_MS = 15_000;

/** Outbox uploads under way, by set id: settled once each has its answer. */
const uploads = new Map<string, Promise<void>>();

/**
 * An outbox upload (offline-outbox.ts) of a set: it goes after every write
 * of that set already sent, and the logger never writes the set while it's
 * out, so an older copy uploaded from Home can't land after a newer save the
 * logger made. An upload is a server action with no timeout of its own, so
 * the logger doesn't wait on it for good (see waitForUpload).
 */
export function inSetOrder<T>(setId: string, work: () => Promise<T>): Promise<T> {
  const key = `set:${setId}`;
  const before = Promise.all([chains.get(key), uploads.get(setId)]);
  const run = before.then(work, work);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  uploads.set(setId, settled);
  void settled.then(() => {
    if (uploads.get(setId) === settled) uploads.delete(setId);
  });
  return run;
}

/**
 * Waits for an outbox upload of the set that's still out, for so long. If
 * it's still out after that, the write fails without being sent (code
 * "held"): the logger shows it unsaved and keeps its copy on the device, to
 * go once the upload has its answer. Never sent past it: an upload that
 * landed after a newer save (or committed with its answer lost) would have
 * put the older numbers back with nothing left to fix them.
 */
async function waitForUpload(setId: string): Promise<void> {
  const upload = uploads.get(setId);
  if (!upload) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const held = await Promise.race([
    upload.then(() => false),
    new Promise<boolean>((r) => (timer = setTimeout(() => r(true), OUTBOX_HOLD_MS))),
  ]);
  clearTimeout(timer);
  if (held) throw Object.assign(new Error("An earlier upload of this set is still out"), { code: "held" });
}

/** A write that died this fast without an answer never got anywhere: it's sent again. */
const RESEND_WINDOW_MS = 4_000;

type Result<T> = { data: T; error: unknown; status: number };

/**
 * One database request that fails, rather than hangs, after TIMEOUT_MS.
 * Every write here is safe to repeat (an upsert or delete by id, a value
 * set), so one that died at once on a connection the network had dropped
 * goes again on a fresh one, as the browser already does for reads.
 */
async function request<T>(send: (signal: AbortSignal) => PromiseLike<Result<T>>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const began = Date.now();
    let result = await send(controller.signal);
    if (
      result.error &&
      result.status === 0 &&
      !controller.signal.aborted &&
      navigator.onLine &&
      Date.now() - began < RESEND_WINDOW_MS
    ) {
      result = await send(controller.signal);
    }
    if (result.error) throw result.error;
    return result.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What kind of failure, for the report (never the message): "timeout",
 * "network" (no answer), or the database's error code.
 */
export function failureCode(err: unknown): string {
  const e = (err ?? {}) as { message?: unknown; code?: unknown; issues?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  if (Array.isArray(e.issues)) return "invalid";
  if (message.startsWith("AbortError")) return "timeout";
  if (e.code === "held" || e.code === "account") return e.code;
  if (typeof e.code === "string" && e.code) return `db ${e.code.slice(0, 12)}`;
  return "network";
}

/** Saves a set (an upsert on its id, so sending it again is harmless). */
export function saveSetNow(input: SetWrite, userId: string): Promise<void> {
  const v = setWriteSchema.parse(input);
  return inOrder(`set:${v.id}`, async () => {
    await waitForUpload(v.id);
    return request((signal) => createClient().from("set").upsert(setRow(v, userId)).abortSignal(signal));
  }).then(() => undefined);
}

/** Deletes a set; one already gone is fine. */
export function deleteSetNow(id: string): Promise<void> {
  return inOrder(`set:${id}`, async () => {
    await waitForUpload(id);
    return request((signal) => createClient().from("set").delete().eq("id", id).abortSignal(signal));
  }).then(() => undefined);
}

/** "Done with this one", or picked back up. */
export function setEndedNow(sessionExerciseId: string, ended: boolean): Promise<void> {
  const endedAt = ended ? new Date().toISOString() : null;
  return inOrder(`ended:${sessionExerciseId}`, () =>
    request((signal) =>
      createClient()
        .from("session_exercise")
        .update({ ended_at: endedAt })
        .eq("id", sessionExerciseId)
        .abortSignal(signal),
    ),
  ).then(() => undefined);
}

/** The longest note on a lift, as the database allows it. */
export const LIFT_NOTE_MAX = 200;

/**
 * The lifter's own note on a movement: saved (an upsert on lifter and
 * exercise), or deleted when it's cleared. The account is named, so a note
 * kept on the device for one account can't land in another's (row-level
 * security refuses it). Notes on one movement land in the order written.
 */
export function saveLiftNoteNow(exerciseId: string, note: string | null, userId: string): Promise<void> {
  const text = note?.trim().slice(0, LIFT_NOTE_MAX).trim() || null;
  // It goes as its own account or not at all. A removal sent as another
  // account deletes nothing and still answers "done", so the request carries
  // the access token of the account the note is for, taken from the session
  // as it's checked: signed in as someone else (or no one), it isn't sent,
  // and it's kept; a switch after the check can't change who it goes as.
  return inOrder(`note:${exerciseId}`, async () => {
    const { data } = await createClient().auth.getSession();
    const session = data.session;
    if (session?.user.id !== userId) {
      throw Object.assign(new Error("Signed in as another account"), { code: "account" });
    }
    const db = createClientAs(session.access_token);
    await request((signal) =>
      text
        ? db
            .from("exercise_note")
            .upsert({ user_id: userId, exercise_id: exerciseId, note: text }, { onConflict: "user_id,exercise_id" })
            .abortSignal(signal)
        : db
            .from("exercise_note")
            .delete()
            .eq("user_id", userId)
            .eq("exercise_id", exerciseId)
            .abortSignal(signal),
    );
  });
}

/** Every set in the workout as the database has it, its exercises, and whether it's finished. */
export async function readSessionSets(sessionId: string): Promise<SessionSets> {
  const data = await request((signal) =>
    createClient().from("session").select(SESSION_SETS_SELECT).eq("id", sessionId).abortSignal(signal).maybeSingle(),
  );
  return toSessionSets(data);
}

"use client";

import { createClient } from "@/lib/supabase/client";
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
  if (typeof e.code === "string" && e.code) return `db ${e.code.slice(0, 12)}`;
  return "network";
}

/** Saves a set (an upsert on its id, so sending it again is harmless). */
export function saveSetNow(input: SetWrite, userId: string): Promise<void> {
  const v = setWriteSchema.parse(input);
  return inOrder(`set:${v.id}`, () =>
    request((signal) => createClient().from("set").upsert(setRow(v, userId)).abortSignal(signal)),
  ).then(() => undefined);
}

/** Deletes a set; one already gone is fine. */
export function deleteSetNow(id: string): Promise<void> {
  return inOrder(`set:${id}`, () =>
    request((signal) => createClient().from("set").delete().eq("id", id).abortSignal(signal)),
  ).then(() => undefined);
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

/** Every set in the workout as the database has it, its exercises, and whether it's finished. */
export async function readSessionSets(sessionId: string): Promise<SessionSets> {
  const data = await request((signal) =>
    createClient().from("session").select(SESSION_SETS_SELECT).eq("id", sessionId).abortSignal(signal).maybeSingle(),
  );
  return toSessionSets(data);
}

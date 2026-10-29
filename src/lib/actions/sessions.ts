"use server";

import { z } from "zod";
import { supersetChanges } from "@/lib/supersets";
import { APPEND } from "@/lib/positions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getAuthedContext } from "@/lib/auth";
import {
  getActiveSession,
  getLastPerformances,
  type LastPerformance,
} from "@/lib/data/sessions";
import { nudgeWidgets, refreshWidgets, widgetDevices } from "@/lib/widget-push";
import type { TablesUpdate } from "@/lib/database.types";

/**
 * Create a session and open the logger. A session can come from a program day
 * (links to the program), a bare template, or be freeform.
 */
export async function startSession(input: {
  templateId?: string | null;
  programDayId?: string | null;
  /** The client's local calendar date (YYYY-MM-DD). See {@link todayLocalISO}. */
  localDate?: string | null;
}) {
  const v = z
    .object({
      templateId: z.string().uuid().nullable().optional(),
      programDayId: z.string().uuid().nullable().optional(),
      localDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();

  // One workout at a time. A workout already under way wins, as it does on the
  // watch and for Siri's /log?start=: starting another would leave that one
  // open behind the new one, never finished. Discard it from the resume banner
  // to start fresh. A session left open for hours doesn't count.
  const live = await getActiveSession();
  if (live && !live.stale) redirect(`/log/${live.id}`);

  // A session advances the program ONLY when it was started from an explicit
  // program day. Freeform work and bare templates stay off-plan by design: we
  // used to infer the program whenever a template happened to match a day in it,
  // which silently burned a rung of the rotation on workouts the lifter never
  // meant as program work. Callers that want a start to count must pass
  // `programDayId` (see the /log starter and StartWorkoutButton).
  //
  // One transaction in Postgres (start_session): the session and its copied
  // exercises land together or not at all.
  const { data: sessionId, error } = await supabase.rpc("start_session", {
    ...(v.templateId ? { p_template_id: v.templateId } : {}),
    ...(v.programDayId ? { p_program_day_id: v.programDayId } : {}),
    ...(v.localDate ? { p_date: v.localDate } : {}),
  });
  if (error) throw error;

  redirect(`/log/${sessionId}`);
}

/**
 * Appends an exercise to the session. Returns the new row id, plus the lifter's
 * last performance on that movement so the logger can show the "last:" target
 * and copy it forward, same as for exercises the session started with.
 */
export async function addSessionExercise(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<{ id: string; lastPerformance: LastPerformance | null }> {
  const { sessionId, exerciseId } = z
    .object({ sessionId: z.string().uuid(), exerciseId: z.string().uuid() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const { data, error } = await supabase
    .from("session_exercise")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      exercise_id: exerciseId,
      position: APPEND,
    })
    .select("id")
    .single();
  if (error) throw error;
  const previous = await getLastPerformances([exerciseId], sessionId);
  return { id: data.id, lastPerformance: previous[exerciseId] ?? null };
}

export async function removeSessionExercise(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase
    .from("session_exercise")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Swaps a movement for this workout only. The template, and so every
 * workout to come, is changed on the Templates page, never from here. With
 * sets already logged, those stay on the movement they were done on: the new
 * one goes in right after it (swap_session_exercise), and this returns its
 * row, with the lifter's last performance on it for "last:" and copy-forward.
 */
export async function swapSessionExercise(input: {
  sessionExerciseId: string;
  newExerciseId: string;
}): Promise<{ id: string; split: boolean; lastPerformance: LastPerformance | null }> {
  const v = z
    .object({
      sessionExerciseId: z.string().uuid(),
      newExerciseId: z.string().uuid(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();

  const { data, error } = await supabase.rpc("swap_session_exercise", {
    p_id: v.sessionExerciseId,
    p_exercise: v.newExerciseId,
  });
  if (error) throw error;
  const result = z.object({ id: z.string().uuid(), split: z.boolean() }).parse(data);
  const { data: row } = await supabase
    .from("session_exercise")
    .select("session_id")
    .eq("id", result.id)
    .maybeSingle();
  const previous = await getLastPerformances([v.newExerciseId], row?.session_id);
  if (row) revalidatePath(`/log/${row.session_id}`);
  return { ...result, lastPerformance: previous[v.newExerciseId] ?? null };
}

const setSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0).max(9999),
  // At least one rep: a row without one is a draft that stays on the device.
  reps: z.number().int().min(1).max(999),
  rpe: z.number().min(0).max(10).nullable(),
  isWarmup: z.boolean(),
  /** A drop or rest-pause set; absent from a build before them, which only logs plain ones. */
  kind: z.enum(["drop", "rest_pause"]).nullable().optional(),
  /** When it was logged on the device (epoch ms), for a set that reaches the
   *  server late (offline). Becomes its created_at, which heart-rate reads
   *  line the sets up by. */
  loggedAt: z.number().int().positive().optional(),
});

/** A device's clock is trusted for a week back and a few minutes ahead. */
function plausibleLoggedAt(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined;
  const now = Date.now();
  if (ms < now - 7 * 24 * 3600_000 || ms > now + 5 * 60_000) return undefined;
  return new Date(ms).toISOString();
}

/**
 * Idempotent upsert keyed on a client-generated set id, repeated autosaves of
 * the same row can't create duplicates. Deliberately does NOT revalidate: the
 * logger owns its own state, this just persists.
 */
export async function saveSet(input: z.input<typeof setSchema>) {
  const v = setSchema.parse(input);
  const { supabase, user } = await getAuthedContext();
  const loggedAt = plausibleLoggedAt(v.loggedAt);
  const { error } = await supabase.from("set").upsert({
    id: v.id,
    user_id: user.id,
    session_exercise_id: v.sessionExerciseId,
    set_number: v.setNumber,
    weight_kg: v.weightKg,
    reps: v.reps,
    rpe: v.rpe,
    is_warmup: v.isWarmup,
    ...(v.kind !== undefined ? { kind: v.kind } : {}),
    // The same first-logged time on every save of the set, so editing it
    // later doesn't move when it happened.
    ...(loggedAt ? { created_at: loggedAt } : {}),
    is_completed: true,
  });
  if (error) throw error;
}

/**
 * Uploads one write queued on a device (offline-outbox.ts) from outside its
 * workout's page. Says whether a failure is for good (its workout or
 * exercise is gone, it isn't this account's, or it breaks a rule), so the
 * device can let it go, or worth another try (no connection, a busy server).
 */
export async function replaySet(
  input: z.input<typeof setSchema> & { deleted?: boolean },
): Promise<{ ok: true } | { ok: false; permanent: boolean }> {
  try {
    if (input.deleted) {
      await deleteSet({ id: input.id });
      return { ok: true };
    }
    const parsed = setSchema.safeParse(input);
    if (!parsed.success) return { ok: false, permanent: true };
    await saveSet(parsed.data);
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: unknown }).code;
    return { ok: false, permanent: code === "23503" || code === "23514" || code === "42501" || code === "22P02" };
  }
}

/**
 * "Done with this one" (or picking it back up), kept with the workout so the
 * watch, Siri and a reload agree on what's next (next-set.ts).
 */
export async function setExerciseEnded(input: { sessionExerciseId: string; ended: boolean }) {
  const v = z.object({ sessionExerciseId: z.string().uuid(), ended: z.boolean() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase
    .from("session_exercise")
    .update({ ended_at: v.ended ? new Date().toISOString() : null })
    .eq("id", v.sessionExerciseId);
  if (error) throw error;
}

/**
 * Links a session exercise with the one after it in a superset, or takes it
 * out of its superset (supersets.ts). For this workout only, like a swap:
 * the template's supersets are set on the Templates page.
 */
export async function setSessionSuperset(input: { sessionExerciseId: string; link: boolean }) {
  const v = z.object({ sessionExerciseId: z.string().uuid(), link: z.boolean() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { data: se, error: seErr } = await supabase
    .from("session_exercise")
    .select("id, session_id")
    .eq("id", v.sessionExerciseId)
    .maybeSingle();
  if (seErr) throw seErr;
  if (!se) throw new Error("Session exercise not found");
  const { data: rows, error: rowsErr } = await supabase
    .from("session_exercise")
    .select("id, position, superset")
    .eq("session_id", se.session_id)
    .order("position", { ascending: true });
  if (rowsErr) throw rowsErr;
  const list = rows ?? [];
  const changes = supersetChanges(list, list.findIndex((r) => r.id === se.id), v.link);
  // Every row that changes, in one transaction.
  const { error } = await supabase.rpc("apply_superset_changes", {
    p_table: "session_exercise",
    p_changes: changes,
  });
  if (error) throw error;
  revalidatePath(`/log/${se.session_id}`);
  return changes;
}

export type SessionSet = {
  seId: string;
  id: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  kind: "drop" | "rest_pause" | null;
};

/**
 * Every set in a session as the server has it, its exercises, and whether
 * it's been finished. The logger uses it to pick up what another device did
 * to the workout: sets logged, changed or deleted on the Apple Watch, Siri
 * or another phone or browser, and a finish.
 */
export async function getSessionSets(input: {
  sessionId: string;
}): Promise<{ finished: boolean; sets: SessionSet[]; exercises: { id: string; exerciseId: string }[] }> {
  const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase
    .from("session")
    .select("finished_at, session_exercise(id, exercise_id, set(id, set_number, weight_kg, reps, rpe, is_warmup, kind))")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { finished: true, sets: [], exercises: [] };
  const sets = data.session_exercise.flatMap((se) =>
    se.set.map((s) => ({
      seId: se.id,
      id: s.id,
      setNumber: s.set_number,
      weightKg: Number(s.weight_kg),
      reps: s.reps,
      rpe: s.rpe === null ? null : Number(s.rpe),
      isWarmup: s.is_warmup,
      kind: s.kind === "drop" || s.kind === "rest_pause" ? (s.kind as SessionSet["kind"]) : null,
    })),
  );
  return {
    finished: data.finished_at !== null,
    sets,
    exercises: data.session_exercise.map((se) => ({ id: se.id, exerciseId: se.exercise_id })),
  };
}

export async function deleteSet(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("set").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSessionMeta(input: {
  sessionId: string;
  title?: string | null;
  notes?: string | null;
  durationMin?: number | null;
  date?: string;
}) {
  const v = z
    .object({
      sessionId: z.string().uuid(),
      title: z.string().max(120).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      durationMin: z.number().int().min(0).max(1000).nullable().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();

  const patch: TablesUpdate<"session"> = {};
  if (v.title !== undefined) patch.title = v.title;
  if (v.notes !== undefined) patch.notes = v.notes;
  if (v.durationMin !== undefined) patch.duration_min = v.durationMin;
  if (v.date !== undefined) patch.date = v.date;

  const { error } = await supabase
    .from("session")
    .update(patch)
    .eq("id", v.sessionId);
  if (error) throw error;
  revalidatePath(`/log/${v.sessionId}`);
  revalidatePath(`/history/${v.sessionId}`);
}

type Supabase = Awaited<ReturnType<typeof getAuthedContext>>["supabase"];

/**
 * Deletes a workout. One with sets in it goes to Recently deleted (whole,
 * restorable for 30 days: trash_session); an empty start just goes.
 */
async function removeSession(supabase: Supabase, id: string) {
  const { data: logged, error: readErr } = await supabase
    .from("session_exercise")
    .select("id, set!inner(id)")
    .eq("session_id", id)
    .limit(1);
  if (readErr) throw readErr;
  if (logged.length > 0) {
    const { error } = await supabase.rpc("trash_session", { p_session: id });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("session").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSession(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase, user } = await getAuthedContext();
  await removeSession(supabase, id);
  await nudgeWidgets(supabase, user.id);
  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

/** Delete every logged session (cascades to exercises + sets), and Recently deleted with them. Irreversible. */
export async function clearHistory() {
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("session")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
  const { error: trashErr } = await supabase.from("deleted_session").delete().eq("user_id", user.id);
  if (trashErr) throw trashErr;
  await nudgeWidgets(supabase, user.id);
  // Wipe skips too so the program rotation starts clean with the history.
  await supabase.from("program_skip").delete().eq("user_id", user.id);
  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidatePath("/programs");
}

/** Persist an optional duration and jump to the finished session's detail. */
export async function finishSession(input: {
  sessionId: string;
  durationMin?: number | null;
  /** False: return once it's recorded, for a caller that shows the finish
   *  first and navigates itself (the logger). */
  navigate?: boolean;
}) {
  const v = z
    .object({
      sessionId: z.string().uuid(),
      durationMin: z.number().int().min(0).max(1000).nullable().optional(),
      navigate: z.boolean().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  // Saving a session reopened to fix it keeps its original finish time.
  const { data: current, error: readErr } = await supabase
    .from("session")
    .select("finished_at")
    .eq("id", v.sessionId)
    .single();
  if (readErr) throw readErr;
  const patch: TablesUpdate<"session"> = {};
  if (!current.finished_at) patch.finished_at = new Date().toISOString();
  if (v.durationMin !== undefined && v.durationMin !== null) {
    patch.duration_min = v.durationMin;
  }
  // Checked, not fire-and-forget: redirecting to the finished view after a
  // failed write would show the session as done while it stays in progress.
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("session")
      .update(patch)
      .eq("id", v.sessionId);
    if (error) throw error;
  }
  revalidatePath("/dashboard");
  revalidatePath("/history");
  // The iPhone's widgets catch up on their own (a silent push), after the redirect.
  const devices = await widgetDevices(supabase, user.id).catch(() => []);
  after(() => refreshWidgets(devices));
  if (v.navigate === false) return { ok: true as const };
  redirect(`/history/${v.sessionId}`);
}

/** Delete a workout without leaving the page: discarding one under way, or a swipe in History. */
export async function discardSession(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase, user } = await getAuthedContext();
  await removeSession(supabase, id);
  await nudgeWidgets(supabase, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/history");
}

/** Brings a workout back from Recently deleted, exactly as it was. */
export async function restoreSession(
  input: { id: string },
): Promise<{ ok: true; sessionId: string } | { ok: false; reason: "exercise-missing" }> {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase, user } = await getAuthedContext();
  const { data, error } = await supabase.rpc("restore_session", { p_id: id });
  // A custom exercise deleted since: returned, not thrown, so the page can say so.
  if (error?.message.includes("exercise missing")) return { ok: false, reason: "exercise-missing" };
  if (error) throw error;
  await nudgeWidgets(supabase, user.id);
  revalidatePath("/history");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  revalidatePath("/programs");
  return { ok: true, sessionId: data };
}

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
import { setRow, setWriteSchema, type SetWrite } from "@/lib/set-write";

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
  if (live && !live.stale) {
    revalidatePath("/", "layout");
    redirect(`/log/${live.id}`);
  }

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

  revalidatePath("/", "layout");
  redirect(`/log/${sessionId}`);
}

/**
 * Starts a past workout again (repeat_session): the exercises that were done,
 * in order, with what was done as the targets, so the logger's last time and
 * progression work as they do for a template day. Off-plan, like any start
 * that isn't a program day; a workout already under way wins, as for
 * startSession.
 */
export async function repeatSession(input: { sessionId: string; localDate?: string | null }) {
  const v = z
    .object({
      sessionId: z.string().uuid(),
      localDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const live = await getActiveSession();
  if (live && !live.stale) {
    revalidatePath("/", "layout");
    redirect(`/log/${live.id}`);
  }
  const { data: sessionId, error } = await supabase.rpc("repeat_session", {
    p_session: v.sessionId,
    ...(v.localDate ? { p_date: v.localDate } : {}),
  });
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect(`/log/${sessionId}`);
}

/**
 * Keeps a workout as a template (template_from_session): what was done, as
 * many sets as were done in the reps they were done in, at the end of the
 * lifter's templates. The workout itself is untouched.
 */
export async function saveSessionAsTemplate(input: { sessionId: string; name: string }): Promise<{ id: string }> {
  const v = z
    .object({ sessionId: z.string().uuid(), name: z.string().trim().min(1).max(120) })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("template_from_session", {
    p_session: v.sessionId,
    p_name: v.name,
  });
  if (error) throw error;
  revalidatePath("/templates");
  revalidatePath("/log");
  return { id: data };
}

/**
 * A workout done without logging it live: dated, timed and already over,
 * so the logger opens it to be filled in (editing, with no clock running),
 * and Recovery and the week read it as when it happened.
 */
export async function logPastSession(input: { date: string; startedAt: number; durationMin: number }) {
  const v = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startedAt: z.number().int().positive(),
      durationMin: z.number().int().min(1).max(600),
    })
    .parse(input);
  const end = v.startedAt + v.durationMin * 60_000;
  if (end > Date.now() + 60_000) throw new Error("A past workout can't end in the future");
  if (v.startedAt < Date.now() - 400 * 24 * 3600_000) throw new Error("Too far back");
  const { supabase, user } = await getAuthedContext();
  const { data, error } = await supabase
    .from("session")
    .insert({
      user_id: user.id,
      date: v.date,
      created_at: new Date(v.startedAt).toISOString(),
      finished_at: new Date(end).toISOString(),
      duration_min: v.durationMin,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect(`/log/${data.id}`);
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

/**
 * Idempotent upsert keyed on a client-generated set id, repeated autosaves of
 * the same row can't create duplicates. Deliberately does NOT revalidate: the
 * logger owns its own state, this just persists.
 */
export async function saveSet(input: SetWrite) {
  const v = setWriteSchema.parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("set").upsert(setRow(v, user.id));
  if (error) throw error;
}

/**
 * Uploads one write queued on a device (offline-outbox.ts) from outside its
 * workout's page, for the account it was logged under (`userId`). Signed in
 * as anyone else, or not at all, nothing is written and the device keeps it
 * (`wrongAccount`: stop sending). Otherwise says whether a failure is for
 * good (its workout or exercise is gone, or it breaks a rule), so the device
 * can let it go, or worth another try (no connection, a busy server).
 */
export async function replaySet(
  input: SetWrite & { deleted?: boolean; userId: string },
): Promise<{ ok: true } | { ok: false; permanent: boolean; wrongAccount?: boolean }> {
  try {
    const { user } = await getAuthedContext().catch(() => ({ user: null }));
    if (!user || user.id !== input.userId) return { ok: false, permanent: false, wrongAccount: true };
    if (input.deleted) {
      await deleteSet({ id: input.id });
      return { ok: true };
    }
    const parsed = setWriteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, permanent: true };
    await saveSet(parsed.data);
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: unknown }).code;
    return { ok: false, permanent: code === "23503" || code === "23514" || code === "42501" || code === "22P02" };
  }
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
  /** When it ended (epoch ms), if not now: the last set, for a workout
   *  finished well after it (the logger asks). Kept between its start and now. */
  finishedAt?: number | null;
  /** False: return once it's recorded, for a caller that shows the finish
   *  first and navigates itself (the logger). */
  navigate?: boolean;
}) {
  const v = z
    .object({
      sessionId: z.string().uuid(),
      durationMin: z.number().int().min(0).max(1000).nullable().optional(),
      finishedAt: z.number().int().positive().nullable().optional(),
      navigate: z.boolean().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  // Saving a session reopened to fix it keeps its original finish time.
  const { data: current, error: readErr } = await supabase
    .from("session")
    .select("finished_at, created_at")
    .eq("id", v.sessionId)
    .single();
  if (readErr) throw readErr;
  const patch: TablesUpdate<"session"> = {};
  if (!current.finished_at) {
    const at = v.finishedAt
      ? Math.min(Date.now(), Math.max(Date.parse(current.created_at), v.finishedAt))
      : Date.now();
    patch.finished_at = new Date(at).toISOString();
  }
  if (v.durationMin !== undefined && v.durationMin !== null) {
    patch.duration_min = v.durationMin;
  }
  // Checked, not fire-and-forget: redirecting to the finished view after a
  // failed write would show the session as done while it stays in progress.
  if (Object.keys(patch).length > 0) {
    let write = supabase
      .from("session")
      .update(patch)
      .eq("id", v.sessionId);
    // Another device can finish after our read. Only the first finish
    // records its time and duration; editing an already finished one still
    // updates the duration above without changing when it ended.
    if (patch.finished_at) write = write.is("finished_at", null);
    const { error } = await write;
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

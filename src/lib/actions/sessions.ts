"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/auth";
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
  const { supabase, user } = await getAuthedContext();

  let templateId: string | null = v.templateId ?? null;
  let programId: string | null = null;

  if (v.programDayId) {
    const { data: pd } = await supabase
      .from("program_day")
      .select("template_id, program_id")
      .eq("id", v.programDayId)
      .maybeSingle();
    if (!pd) throw new Error("Program day not found");
    templateId = pd.template_id;
    programId = pd.program_id;
  }

  // If a bare template was started (e.g. from the /log picker) and it happens to
  // be a day in the user's active program, attribute the session to that program
  // so it advances the rotation, otherwise the day silently wouldn't count.
  if (templateId && !programId) {
    const { data: active } = await supabase
      .from("program")
      .select("id, program_day(template_id)")
      .eq("is_active", true)
      .maybeSingle();
    if (active?.program_day?.some((d) => d.template_id === templateId)) {
      programId = active.id;
    }
  }

  let title: string | null = null;
  if (templateId) {
    const { data: tmpl } = await supabase
      .from("workout_template")
      .select("name, day_label")
      .eq("id", templateId)
      .maybeSingle();
    if (tmpl) title = tmpl.day_label || tmpl.name;
  }

  const { data: session, error } = await supabase
    .from("session")
    .insert({
      user_id: user.id,
      template_id: templateId,
      program_id: programId,
      title,
      // Stamp the lifter's local day; fall back to the DB `current_date` default.
      ...(v.localDate ? { date: v.localDate } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;

  // Instantiate the template's exercises into the session (preserving order).
  if (templateId) {
    const { data: tmplExercises } = await supabase
      .from("template_exercise")
      .select("exercise_id, position, note")
      .eq("template_id", templateId)
      .order("position", { ascending: true });

    if (tmplExercises && tmplExercises.length > 0) {
      const rows = tmplExercises.map((te) => ({
        user_id: user.id,
        session_id: session.id,
        exercise_id: te.exercise_id,
        position: te.position,
        note: te.note,
      }));
      const { error: seErr } = await supabase
        .from("session_exercise")
        .insert(rows);
      if (seErr) throw seErr;
    }
  }

  redirect(`/log/${session.id}`);
}

/** Appends an exercise to the session; returns the new row id for optimistic UI. */
export async function addSessionExercise(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<{ id: string }> {
  const { sessionId, exerciseId } = z
    .object({ sessionId: z.string().uuid(), exerciseId: z.string().uuid() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const { data: last } = await supabase
    .from("session_exercise")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("session_exercise")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      exercise_id: exerciseId,
      position,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
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
 * Swap the movement on a session exercise mid-workout (e.g. seated rows instead
 * of Pendlay rows). Keeps any sets already logged (they re-attribute to the new
 * movement). If the session came from a template, the swap also becomes that
 * day's new default: the matching `template_exercise` (same position + old
 * movement) is updated so the substitution sticks for future sessions.
 */
export async function swapSessionExercise(input: {
  sessionExerciseId: string;
  newExerciseId: string;
}) {
  const v = z
    .object({
      sessionExerciseId: z.string().uuid(),
      newExerciseId: z.string().uuid(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();

  const { data: se, error: seErr } = await supabase
    .from("session_exercise")
    .select("id, session_id, exercise_id, position")
    .eq("id", v.sessionExerciseId)
    .maybeSingle();
  if (seErr) throw seErr;
  if (!se) throw new Error("Session exercise not found");
  const oldExerciseId = se.exercise_id;

  const { error: upErr } = await supabase
    .from("session_exercise")
    .update({ exercise_id: v.newExerciseId })
    .eq("id", v.sessionExerciseId);
  if (upErr) throw upErr;

  // Persist the swap into the day's template so it carries forward.
  const { data: sess } = await supabase
    .from("session")
    .select("template_id")
    .eq("id", se.session_id)
    .maybeSingle();
  if (sess?.template_id) {
    await supabase
      .from("template_exercise")
      .update({ exercise_id: v.newExerciseId })
      .eq("template_id", sess.template_id)
      .eq("position", se.position)
      .eq("exercise_id", oldExerciseId);
  }

  revalidatePath(`/log/${se.session_id}`);
  revalidatePath("/templates");
  revalidatePath("/programs");
}

const setSchema = z.object({
  id: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0).max(9999),
  reps: z.number().int().min(0).max(9999),
  rpe: z.number().min(0).max(10).nullable(),
  isWarmup: z.boolean(),
});

/**
 * Idempotent upsert keyed on a client-generated set id, repeated autosaves of
 * the same row can't create duplicates. Deliberately does NOT revalidate: the
 * logger owns its own state, this just persists.
 */
export async function saveSet(input: z.input<typeof setSchema>) {
  const v = setSchema.parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("set").upsert({
    id: v.id,
    user_id: user.id,
    session_exercise_id: v.sessionExerciseId,
    set_number: v.setNumber,
    weight_kg: v.weightKg,
    reps: v.reps,
    rpe: v.rpe,
    is_warmup: v.isWarmup,
    is_completed: true,
  });
  if (error) throw error;
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

export async function deleteSession(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("session").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect("/history");
}

/** Delete every logged session (cascades to exercises + sets). Irreversible. */
export async function clearHistory() {
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase
    .from("session")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
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
}) {
  const v = z
    .object({
      sessionId: z.string().uuid(),
      durationMin: z.number().int().min(0).max(1000).nullable().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const patch: TablesUpdate<"session"> = {
    finished_at: new Date().toISOString(),
  };
  if (v.durationMin !== undefined && v.durationMin !== null) {
    patch.duration_min = v.durationMin;
  }
  await supabase.from("session").update(patch).eq("id", v.sessionId);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  redirect(`/history/${v.sessionId}`);
}

/** Abandon an in-progress session from the resume banner (no redirect). */
export async function discardSession(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("session").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard");
  revalidatePath("/history");
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { getAuthedContext } from "@/lib/auth";
import type { TablesUpdate } from "@/lib/database.types";

/** Ensure at most one active program: clear any others for this user. */
async function deactivateAll(
  supabase: Awaited<ReturnType<typeof getAuthedContext>>["supabase"],
  userId: string,
) {
  await supabase
    .from("program")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
}

export async function createProgram(input: {
  name: string;
  durationWeeks: number;
  startDate?: string | null;
  templateIds: string[];
  setActive: boolean;
}): Promise<{ id: string }> {
  const v = z
    .object({
      name: z.string().min(1).max(120),
      durationWeeks: z.number().int().min(1).max(52),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      templateIds: z.array(z.string().uuid()).max(14),
      setActive: z.boolean(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  if (v.setActive) await deactivateAll(supabase, user.id);

  const { data: program, error } = await supabase
    .from("program")
    .insert({
      user_id: user.id,
      name: v.name,
      duration_weeks: v.durationWeeks,
      start_date: v.startDate ?? null,
      is_active: v.setActive,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (v.templateIds.length > 0) {
    const rows = v.templateIds.map((templateId, i) => ({
      user_id: user.id,
      program_id: program.id,
      template_id: templateId,
      position: i,
    }));
    const { error: dErr } = await supabase.from("program_day").insert(rows);
    if (dErr) throw dErr;
  }

  revalidatePath("/programs");
  revalidatePath("/dashboard");
  return { id: program.id };
}

export async function updateProgram(input: {
  id: string;
  name?: string;
  durationWeeks?: number;
  startDate?: string | null;
  notes?: string | null;
}) {
  const v = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      durationWeeks: z.number().int().min(1).max(52).optional(),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      notes: z.string().max(2000).nullable().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const patch: TablesUpdate<"program"> = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.durationWeeks !== undefined) patch.duration_weeks = v.durationWeeks;
  if (v.startDate !== undefined) patch.start_date = v.startDate;
  if (v.notes !== undefined) patch.notes = v.notes;
  const { error } = await supabase.from("program").update(patch).eq("id", v.id);
  if (error) throw error;
  revalidatePath("/programs");
  revalidatePath(`/programs/${v.id}`);
  revalidatePath("/dashboard");
}

export async function setActiveProgram(input: { id: string; active: boolean }) {
  const v = z
    .object({ id: z.string().uuid(), active: z.boolean() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  if (v.active) {
    await deactivateAll(supabase, user.id);
    const patch: TablesUpdate<"program"> = { is_active: true };
    // Starting a program with no start date begins it today.
    const { data: existing } = await supabase
      .from("program")
      .select("start_date")
      .eq("id", v.id)
      .maybeSingle();
    if (existing && !existing.start_date) {
      patch.start_date = new Date().toISOString().slice(0, 10);
    }
    const { error } = await supabase
      .from("program")
      .update(patch)
      .eq("id", v.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("program")
      .update({ is_active: false })
      .eq("id", v.id);
    if (error) throw error;
  }
  revalidatePath("/programs");
  revalidatePath(`/programs/${v.id}`);
  revalidatePath("/dashboard");
}

/** Skip today's programmed day: advances the rotation without a logged session. */
export async function skipWorkout(input: { programDayId: string }) {
  const { programDayId } = z
    .object({ programDayId: z.string().uuid() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { data: pd } = await supabase
    .from("program_day")
    .select("program_id")
    .eq("id", programDayId)
    .maybeSingle();
  if (!pd) throw new Error("Program day not found");
  const { error } = await supabase.from("program_skip").insert({
    user_id: user.id,
    program_id: pd.program_id,
    program_day_id: programDayId,
  });
  if (error) throw error;
  revalidatePath("/programs");
  revalidatePath(`/programs/${pd.program_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
}

/**
 * Pause a program for a while (injury, travel, a rest day). The week counter
 * freezes at this instant: `paused_at` is stamped, and progress is computed
 * as of that moment until the block is resumed.
 */
export async function pauseProgram(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { data: p } = await supabase
    .from("program")
    .select("paused_at, start_date")
    .eq("id", id)
    .maybeSingle();
  if (!p || p.paused_at) return; // already paused / missing
  const { error } = await supabase
    .from("program")
    .update({ paused_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
}

/**
 * Resume a paused program. The block picks up exactly where it left off: the
 * start date is shifted forward by however long it was paused, so the same
 * week and next-workout are restored (rather than the pause silently burning
 * training days).
 */
export async function resumeProgram(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { data: p } = await supabase
    .from("program")
    .select("paused_at, start_date")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.paused_at) return; // not paused

  const patch: TablesUpdate<"program"> = { paused_at: null };
  if (p.start_date) {
    const pausedForDays = Math.max(
      0,
      differenceInCalendarDays(new Date(), new Date(p.paused_at)),
    );
    if (pausedForDays > 0) {
      patch.start_date = format(
        addDays(parseISO(p.start_date), pausedForDays),
        "yyyy-MM-dd",
      );
    }
  }
  const { error } = await supabase.from("program").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/programs");
  revalidatePath(`/programs/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/log");
}

/**
 * Roll back the most recent advance in the program, undoes the last skip, or
 * discards the last logged session (destructive: that session's sets are
 * removed). Used by the "Roll back a day" control.
 */
export async function rollbackLastDay(input: {
  programId: string;
}): Promise<{ removed: "skip" | "session" | "none" }> {
  const { programId } = z
    .object({ programId: z.string().uuid() })
    .parse(input);
  const { supabase } = await getAuthedContext();

  const [{ data: lastSkip }, { data: lastSession }] = await Promise.all([
    supabase
      .from("program_skip")
      .select("id, created_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("session")
      .select("id, created_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const skipTime = lastSkip ? new Date(lastSkip.created_at).getTime() : -1;
  const sessTime = lastSession ? new Date(lastSession.created_at).getTime() : -1;
  if (skipTime < 0 && sessTime < 0) return { removed: "none" };

  let removed: "skip" | "session";
  if (skipTime >= sessTime) {
    await supabase.from("program_skip").delete().eq("id", lastSkip!.id);
    removed = "skip";
  } else {
    // Deleting the session cascades its exercises + sets.
    await supabase.from("session").delete().eq("id", lastSession!.id);
    removed = "session";
  }

  revalidatePath("/programs");
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/progress");
  revalidatePath("/log");
  return { removed };
}

/** Restart the block from week 1 (start date = today). Keeps logged sessions. */
export async function resetProgram(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  // A restart must also clear skips, or old skips (dated today) would advance
  // the fresh week-1 rotation before it even begins.
  await supabase.from("program_skip").delete().eq("program_id", id);
  const { error } = await supabase
    .from("program")
    .update({
      start_date: new Date().toISOString().slice(0, 10),
      paused_at: null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/programs/${id}`);
  revalidatePath("/programs");
  revalidatePath("/dashboard");
}

export async function deleteProgram(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("program").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/programs");
  revalidatePath("/dashboard");
}

export async function addProgramDay(input: {
  programId: string;
  templateId: string;
}) {
  const v = z
    .object({ programId: z.string().uuid(), templateId: z.string().uuid() })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { data: last } = await supabase
    .from("program_day")
    .select("position")
    .eq("program_id", v.programId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;
  const { error } = await supabase.from("program_day").insert({
    user_id: user.id,
    program_id: v.programId,
    template_id: v.templateId,
    position,
  });
  if (error) throw error;
  revalidatePath(`/programs/${v.programId}`);
}

export async function removeProgramDay(input: {
  id: string;
  programId: string;
}) {
  const v = z
    .object({ id: z.string().uuid(), programId: z.string().uuid() })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("program_day").delete().eq("id", v.id);
  if (error) throw error;
  revalidatePath(`/programs/${v.programId}`);
}

export async function moveProgramDay(input: {
  id: string;
  programId: string;
  direction: "up" | "down";
}) {
  const v = z
    .object({
      id: z.string().uuid(),
      programId: z.string().uuid(),
      direction: z.enum(["up", "down"]),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { data: current } = await supabase
    .from("program_day")
    .select("id, position")
    .eq("id", v.id)
    .maybeSingle();
  if (!current) return;
  const q = supabase
    .from("program_day")
    .select("id, position")
    .eq("program_id", v.programId)
    .order("position", { ascending: v.direction === "down" })
    .limit(1);
  const { data: neighbour } = await (v.direction === "up"
    ? q.lt("position", current.position)
    : q.gt("position", current.position)
  ).maybeSingle();
  if (!neighbour) return;
  await supabase
    .from("program_day")
    .update({ position: neighbour.position })
    .eq("id", current.id);
  await supabase
    .from("program_day")
    .update({ position: current.position })
    .eq("id", neighbour.id);
  revalidatePath(`/programs/${v.programId}`);
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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

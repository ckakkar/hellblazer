"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { getPreset } from "@/lib/presets";
import type { TablesUpdate } from "@/lib/database.types";

export async function createTemplate(input: {
  name: string;
  dayLabel?: string | null;
}): Promise<{ id: string }> {
  const v = z
    .object({
      name: z.string().min(1).max(120),
      dayLabel: z.string().max(120).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const { data: last } = await supabase
    .from("workout_template")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("workout_template")
    .insert({
      user_id: user.id,
      name: v.name,
      day_label: v.dayLabel ?? null,
      position,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/templates");
  return { id: data.id };
}

export async function updateTemplate(input: {
  id: string;
  name?: string;
  dayLabel?: string | null;
}) {
  const v = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      dayLabel: z.string().max(120).nullable().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const patch: TablesUpdate<"workout_template"> = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.dayLabel !== undefined) patch.day_label = v.dayLabel;
  const { error } = await supabase
    .from("workout_template")
    .update(patch)
    .eq("id", v.id);
  if (error) throw error;
  revalidatePath("/templates");
}

export async function deleteTemplate(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase
    .from("workout_template")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/templates");
}

export async function addTemplateExercise(input: {
  templateId: string;
  exerciseId: string;
  targetSets?: number | null;
  targetRepRange?: string | null;
}) {
  const v = z
    .object({
      templateId: z.string().uuid(),
      exerciseId: z.string().uuid(),
      targetSets: z.number().int().min(1).max(20).nullable().optional(),
      targetRepRange: z.string().max(20).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const { data: last } = await supabase
    .from("template_exercise")
    .select("position")
    .eq("template_id", v.templateId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("template_exercise").insert({
    user_id: user.id,
    template_id: v.templateId,
    exercise_id: v.exerciseId,
    position,
    target_sets: v.targetSets ?? 3,
    target_rep_range: v.targetRepRange ?? null,
  });
  if (error) throw error;
  revalidatePath("/templates");
}

export async function updateTemplateExercise(input: {
  id: string;
  targetSets?: number | null;
  targetRepRange?: string | null;
  note?: string | null;
}) {
  const v = z
    .object({
      id: z.string().uuid(),
      targetSets: z.number().int().min(1).max(20).nullable().optional(),
      targetRepRange: z.string().max(20).nullable().optional(),
      note: z.string().max(200).nullable().optional(),
    })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const patch: TablesUpdate<"template_exercise"> = {};
  if (v.targetSets !== undefined) patch.target_sets = v.targetSets;
  if (v.targetRepRange !== undefined) patch.target_rep_range = v.targetRepRange;
  if (v.note !== undefined) patch.note = v.note;
  const { error } = await supabase
    .from("template_exercise")
    .update(patch)
    .eq("id", v.id);
  if (error) throw error;
  revalidatePath("/templates");
}

export async function removeTemplateExercise(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase
    .from("template_exercise")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/templates");
}

/** Swap a template exercise with its neighbour to reorder. */
export async function moveTemplateExercise(input: {
  id: string;
  direction: "up" | "down";
}) {
  const v = z
    .object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) })
    .parse(input);
  const { supabase } = await getAuthedContext();

  const { data: current } = await supabase
    .from("template_exercise")
    .select("id, template_id, position")
    .eq("id", v.id)
    .maybeSingle();
  if (!current) return;

  const neighbourQuery = supabase
    .from("template_exercise")
    .select("id, position")
    .eq("template_id", current.template_id)
    .order("position", { ascending: v.direction === "down" })
    .limit(1);
  const { data: neighbour } = await (v.direction === "up"
    ? neighbourQuery.lt("position", current.position)
    : neighbourQuery.gt("position", current.position)
  ).maybeSingle();
  if (!neighbour) return;

  await supabase
    .from("template_exercise")
    .update({ position: neighbour.position })
    .eq("id", current.id);
  await supabase
    .from("template_exercise")
    .update({ position: current.position })
    .eq("id", neighbour.id);
  revalidatePath("/templates");
}

/**
 * One-click load of a starter routine. Maps each preset exercise name to a
 * library exercise the user can see, then creates the templates + prescribed
 * exercises. Skips names that don't resolve (shouldn't happen with seed data).
 */
export async function loadPreset(input: { presetId: string }) {
  const { presetId } = z.object({ presetId: z.string() }).parse(input);
  const preset = getPreset(presetId);
  if (!preset) throw new Error("Unknown preset");
  const { supabase, user } = await getAuthedContext();

  // Build a name → id map from the user's visible library.
  const { data: exercises, error: exErr } = await supabase
    .from("exercise")
    .select("id, name");
  if (exErr) throw exErr;
  const byName = new Map<string, string>();
  for (const e of exercises ?? []) byName.set(e.name.toLowerCase(), e.id);

  // Continue numbering after any existing templates.
  const { data: last } = await supabase
    .from("workout_template")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = (last?.position ?? -1) + 1;
  const createdTemplateIds: string[] = [];

  for (const day of preset.days) {
    const { data: tmpl, error: tErr } = await supabase
      .from("workout_template")
      .insert({
        user_id: user.id,
        name: day.name,
        day_label: day.dayLabel,
        position: position++,
      })
      .select("id")
      .single();
    if (tErr) throw tErr;
    createdTemplateIds.push(tmpl.id);

    const rows = day.exercises
      .map((ex, i) => {
        const exerciseId = byName.get(ex.name.toLowerCase());
        if (!exerciseId) return null;
        return {
          user_id: user.id,
          template_id: tmpl.id,
          exercise_id: exerciseId,
          position: i,
          target_sets: ex.sets,
          target_rep_range: ex.reps,
          note: ex.note ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error: teErr } = await supabase
        .from("template_exercise")
        .insert(rows);
      if (teErr) throw teErr;
    }
  }

  // Bundle the days into a runnable, active program so the user can start
  // training immediately (8-week block starting today).
  await supabase
    .from("program")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);
  const { data: program, error: pErr } = await supabase
    .from("program")
    .insert({
      user_id: user.id,
      name: preset.name,
      duration_weeks: 8,
      start_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  if (createdTemplateIds.length > 0) {
    const dayRows = createdTemplateIds.map((tid, i) => ({
      user_id: user.id,
      program_id: program.id,
      template_id: tid,
      position: i,
    }));
    await supabase.from("program_day").insert(dayRows);
  }

  revalidatePath("/templates");
  revalidatePath("/programs");
  revalidatePath("/dashboard");
}

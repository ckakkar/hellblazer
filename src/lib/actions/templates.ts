"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { getPreset } from "@/lib/presets";
import { getToday } from "@/lib/settings";
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

/**
 * Change the movement on a prescribed template exercise (e.g. while previewing a
 * day, swap Pendlay rows for seated rows). Becomes that day's new default.
 */
export async function swapTemplateExercise(input: {
  id: string;
  newExerciseId: string;
}) {
  const v = z
    .object({ id: z.string().uuid(), newExerciseId: z.string().uuid() })
    .parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase
    .from("template_exercise")
    .update({ exercise_id: v.newExerciseId })
    .eq("id", v.id);
  if (error) throw error;
  revalidatePath("/templates");
  revalidatePath("/programs");
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
  // Both rows move in one transaction (move_template_exercise).
  const { error } = await supabase.rpc("move_template_exercise", {
    p_id: v.id,
    p_direction: v.direction,
  });
  if (error) throw error;
  revalidatePath("/templates");
}

/**
 * Manual "clean up" from the Templates screen: removes what repeated preset
 * loads leave behind (purge_abandoned_templates). Inactive programs never
 * trained go, then templates in no program and no logged session. Anything
 * you've logged against, and your active split, are always kept.
 */
export async function cleanupTemplates() {
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.rpc("purge_abandoned_templates");
  if (error) throw error;
  revalidatePath("/templates");
  revalidatePath("/programs");
  revalidatePath("/log");
  revalidatePath("/dashboard");
}

/**
 * One-click load of a starter routine. Each preset exercise name is matched to
 * a library exercise the user can see; names that don't resolve are skipped
 * (shouldn't happen with the seeded library).
 */
export async function loadPreset(input: { presetId: string }) {
  const { presetId } = z.object({ presetId: z.string() }).parse(input);
  const preset = getPreset(presetId);
  if (!preset) throw new Error("Unknown preset");
  const { supabase } = await getAuthedContext();

  // One transaction (load_preset): it replaces the previous split
  // (deactivates it, purges abandoned blocks and orphaned templates so past
  // loads don't pile up), creates the days and their exercises, and bundles
  // them into an active 8-week block starting today. A failure leaves the old
  // split exactly as it was.
  const { error } = await supabase.rpc("load_preset", {
    p_name: preset.name,
    p_weeks: preset.weeks ?? 8,
    p_today: await getToday(),
    p_days: preset.days.map((day) => ({
      name: day.name,
      dayLabel: day.dayLabel,
      exercises: day.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        note: ex.note ?? null,
      })),
    })),
  });
  if (error) throw error;

  revalidatePath("/templates");
  revalidatePath("/programs");
  revalidatePath("/dashboard");
}

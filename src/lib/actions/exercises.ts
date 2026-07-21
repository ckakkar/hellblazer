"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { MUSCLES, type Muscle } from "@/lib/muscles";
import { EQUIPMENT_OPTIONS, MECHANIC_OPTIONS } from "@/lib/muscles";

const muscleEnum = z.enum(MUSCLES as unknown as [Muscle, ...Muscle[]]);

export async function createCustomExercise(input: {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  mechanic?: (typeof MECHANIC_OPTIONS)[number] | null;
  equipment?: (typeof EQUIPMENT_OPTIONS)[number] | null;
  defaultRepRange?: string | null;
}): Promise<{ id: string }> {
  const v = z
    .object({
      name: z.string().min(1).max(120),
      primaryMuscle: muscleEnum,
      secondaryMuscles: z.array(muscleEnum).max(6),
      mechanic: z.enum(MECHANIC_OPTIONS).nullable().optional(),
      equipment: z.enum(EQUIPMENT_OPTIONS).nullable().optional(),
      defaultRepRange: z.string().max(20).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const { data, error } = await supabase
    .from("exercise")
    .insert({
      user_id: user.id,
      name: v.name,
      primary_muscle: v.primaryMuscle,
      secondary_muscles: v.secondaryMuscles,
      mechanic: v.mechanic ?? null,
      equipment: v.equipment ?? null,
      default_rep_range: v.defaultRepRange ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/exercises");
  return { id: data.id };
}

export async function deleteCustomExercise(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase, user } = await getAuthedContext();
  // RLS already blocks deleting global rows; scope explicitly for clarity.
  const { error } = await supabase
    .from("exercise")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/exercises");
}

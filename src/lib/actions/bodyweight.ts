"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";

export async function logBodyweight(input: { date: string; weightKg: number }) {
  const v = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weightKg: z.number().min(1).max(999),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("bodyweight_log").insert({
    user_id: user.id,
    date: v.date,
    weight_kg: v.weightKg,
  });
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/progress");
}

export async function deleteBodyweight(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.from("bodyweight_log").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/settings");
}

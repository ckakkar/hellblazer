"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { TIER_KEYS } from "@/lib/tiers";

/** Accept a proposed tier (from an evaluation) as the user's new rank. */
export async function setTier(input: { tierKey: string; rationale?: string }) {
  const v = z
    .object({
      tierKey: z.enum(TIER_KEYS as [string, ...string[]]),
      rationale: z.string().max(4000).optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("profile").upsert({
    user_id: user.id,
    tier: v.tierKey,
    tier_rationale: v.rationale ?? null,
    tier_evaluated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

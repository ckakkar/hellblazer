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

/**
 * Store the lifter's demographics — sex, age and height — which sharpen the
 * strength evaluation (standards are sex- and bodyweight-relative). Age is
 * stored as a birth year so it stays correct over time. All fields nullable so
 * any can be cleared.
 */
export async function updateProfileDetails(input: {
  sex?: "male" | "female" | "other" | null;
  age?: number | null;
  heightCm?: number | null;
}) {
  const v = z
    .object({
      sex: z.enum(["male", "female", "other"]).nullable().optional(),
      age: z.number().int().min(10).max(100).nullable().optional(),
      heightCm: z.number().min(80).max(260).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const birthYear =
    v.age == null ? null : new Date().getFullYear() - v.age;

  const { error } = await supabase.from("profile").upsert({
    user_id: user.id,
    sex: v.sex ?? null,
    birth_year: birthYear,
    height_cm: v.heightCm ?? null,
  });
  if (error) throw error;
  revalidatePath("/settings");
}

/**
 * Set (or clear) the lifter's public ring name shown on the leaderboard.
 * Case-insensitively unique — returns a typed result rather than throwing so
 * the UI can show "that name's taken".
 */
export async function setUsername(input: {
  username: string | null;
}): Promise<{ ok: true } | { ok: false; error: "taken" | "invalid" }> {
  const parsed = z
    .object({
      username: z
        .string()
        .trim()
        .min(2)
        .max(24)
        .regex(/^[a-zA-Z0-9 _.-]+$/)
        .nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { supabase, user } = await getAuthedContext();
  const { error } = await supabase.from("profile").upsert({
    user_id: user.id,
    username: parsed.data.username,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "taken" };
    throw error;
  }
  revalidatePath("/settings");
  revalidatePath("/leaderboard");
  return { ok: true };
}

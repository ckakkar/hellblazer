"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAuthedContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getTier, type TierKey } from "@/lib/tiers";
import { isAcceptedBirthday } from "@/lib/age";
import type { TablesInsert } from "@/lib/database.types";

export type AcceptTierResult =
  | { ok: true; tierKey: TierKey }
  | { ok: false; error: "no_verdict" | "not_configured" };

/**
 * Accept the judge's latest verdict as the lifter's rank. Takes no rank from
 * the client: it promotes whatever `evaluateTier` recorded in
 * `profile.pending_tier`, which only the server can write. Rank columns are
 * closed to the lifter's own token, so these writes go through the service
 * client, scoped to the caller.
 */
export async function acceptTier(): Promise<AcceptTierResult> {
  const { user } = await getAuthedContext();
  const svc = createServiceClient();
  if (!svc) return { ok: false, error: "not_configured" };

  const { data: profile, error } = await svc
    .from("profile")
    .select("tier, pending_tier, pending_tier_rationale")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  const proposed = getTier(profile?.pending_tier);
  if (!proposed) return { ok: false, error: "no_verdict" };

  // The ratchet again, at accept time: a verdict delivered before a later
  // promotion must not undo it.
  const current = getTier(profile?.tier);
  const keepCurrent = current !== null && current.rank > proposed.rank;
  const { error: upErr } = await svc
    .from("profile")
    .update({
      ...(keepCurrent
        ? {}
        : {
            tier: proposed.key,
            tier_rationale: profile?.pending_tier_rationale ?? null,
            tier_evaluated_at: new Date().toISOString(),
          }),
      pending_tier: null,
      pending_tier_rationale: null,
    })
    .eq("user_id", user.id);
  if (upErr) throw upErr;

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: true, tierKey: keepCurrent ? current.key : proposed.key };
}

/** Turn down the judge's latest verdict: the rank stays as it is. */
export async function declineTier() {
  const { user } = await getAuthedContext();
  const svc = createServiceClient();
  if (!svc) return;
  const { error } = await svc
    .from("profile")
    .update({ pending_tier: null, pending_tier_rationale: null })
    .eq("user_id", user.id);
  if (error) throw error;
}

/** A yyyy-MM-dd birthday for an age the app accepts (10 to 100). */
const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => isAcceptedBirthday(d, new Date().toISOString().slice(0, 10)));

/** Both birthday columns: the exact date, and its year for older readers. */
function birthColumns(birthDate: string | null) {
  return { birth_date: birthDate, birth_year: birthDate ? Number(birthDate.slice(0, 4)) : null };
}

/**
 * Store the lifter's demographics: sex, birthday and height, which sharpen the
 * strength evaluation (standards are sex- and bodyweight-relative). Age is
 * worked out from the birthday whenever it's needed, so it stays exact.
 * `birthDate` left out means unchanged; null clears it.
 */
export async function updateProfileDetails(input: {
  displayName?: string | null;
  sex?: "male" | "female" | "other" | null;
  birthDate?: string | null;
  heightCm?: number | null;
}) {
  const v = z
    .object({
      displayName: z.string().trim().min(1).max(60).nullable().optional(),
      sex: z.enum(["male", "female", "other"]).nullable().optional(),
      birthDate: birthDateSchema.nullable().optional(),
      heightCm: z.number().min(80).max(260).nullable().optional(),
    })
    .parse(input);
  const { supabase, user } = await getAuthedContext();

  const row: TablesInsert<"profile"> = {
    user_id: user.id,
    display_name: v.displayName ?? null,
    sex: v.sex ?? null,
    height_cm: v.heightCm ?? null,
    // Left out, a profile that only has a birth year keeps it.
    ...(v.birthDate !== undefined ? birthColumns(v.birthDate) : {}),
  };
  const { error } = await supabase.from("profile").upsert(row);
  if (error) throw error;
  revalidatePath("/settings");
}

/**
 * Complete the welcome flow: the lifter's name, ring name, demographics and
 * (optionally) a first bodyweight entry, written in one pass.
 *
 * Every field is optional except the completion itself, someone who'd rather
 * not share their birthday still gets into the app. Stamping `onboarded_at` is what
 * stops the (app) layout bouncing them back to /welcome.
 *
 * The ring name is the one field that can fail (it's case-insensitively
 * unique), so this returns a typed result rather than throwing.
 */
export async function completeOnboarding(input: {
  displayName?: string | null;
  username?: string | null;
  sex?: "male" | "female" | "other" | null;
  birthDate?: string | null;
  heightCm?: number | null;
  bodyweightKg?: number | null;
  /** Client's local calendar date (YYYY-MM-DD). See {@link todayLocalISO}. */
  localDate?: string;
}): Promise<{ ok: true } | { ok: false; error: "taken" | "invalid" }> {
  const parsed = z
    .object({
      displayName: z.string().trim().min(1).max(60).nullable().optional(),
      username: z
        .string()
        .trim()
        .min(2)
        .max(24)
        .regex(/^[a-zA-Z0-9 _.-]+$/)
        .nullable()
        .optional(),
      sex: z.enum(["male", "female", "other"]).nullable().optional(),
      birthDate: birthDateSchema.nullable().optional(),
      heightCm: z.number().min(80).max(260).nullable().optional(),
      bodyweightKg: z.number().min(20).max(400).nullable().optional(),
      localDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const { supabase, user } = await getAuthedContext();

  const { error } = await supabase.from("profile").upsert({
    user_id: user.id,
    display_name: v.displayName ?? null,
    username: v.username ?? null,
    sex: v.sex ?? null,
    ...birthColumns(v.birthDate ?? null),
    height_cm: v.heightCm ?? null,
    onboarded_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "taken" };
    throw error;
  }

  // Seed the bodyweight log so strength standards are bodyweight-relative from
  // the very first evaluation. Non-fatal: onboarding is already committed.
  if (v.bodyweightKg != null && v.localDate) {
    await supabase
      .from("bodyweight_log")
      .insert({
        user_id: user.id,
        date: v.localDate,
        weight_kg: v.bodyweightKg,
      })
      .then(undefined, () => {});
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Set (or clear) the lifter's public ring name shown on King of the Hill.
 * Case-insensitively unique: returns a typed result rather than throwing so
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

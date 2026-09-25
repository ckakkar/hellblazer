"use server";

import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { revokeAppleToken } from "@/lib/apple";

export type DeleteAccountResult = { ok: false; error: string };

/**
 * Deletes the signed-in lifter's account and everything in it. Every table
 * references auth.users with ON DELETE CASCADE, so removing the auth user
 * removes their sessions, sets, programs, templates, bodyweight, profile,
 * push devices and Apple token in one step.
 *
 * Sign in with Apple is revoked first, as App Store rules require. On
 * success this redirects to the landing page; it only returns on failure.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { supabase, user } = await getAuthedContext();
  const svc = createServiceClient();
  if (!svc) return { ok: false, error: "Account deletion isn't available right now. Try again later." };

  const { data: apple } = await svc
    .from("apple_token")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (apple?.refresh_token) await revokeAppleToken(apple.refresh_token);

  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Couldn't delete your account. Try again." };

  // The session died with the user; this clears its cookies.
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

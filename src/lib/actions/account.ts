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

  // Sign in with Apple is revoked first, and its outcome counts: an
  // account deleted while Apple still lists the app as signed in breaks App
  // Store rules, so a failed read or revoke stops here, with nothing deleted,
  // and the lifter can try again.
  const { data: apple, error: appleErr } = await svc
    .from("apple_token")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (appleErr) return { ok: false, error: "Couldn't delete your account. Try again." };
  if (apple?.refresh_token) {
    const revoked =
      (await revokeAppleToken(apple.refresh_token)) || (await revokeAppleToken(apple.refresh_token));
    if (!revoked) {
      console.error("Apple revoke failed during account deletion", user.id);
      return {
        ok: false,
        error: "Couldn't reach Apple to sign Fatty out of your Apple ID. Nothing was deleted. Try again in a moment.",
      };
    }
  }

  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Couldn't delete your account. Try again." };

  // The session died with the user; this clears its cookies.
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

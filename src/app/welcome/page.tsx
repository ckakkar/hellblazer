import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getProfile } from "@/lib/data/profile";
import { getUnit } from "@/lib/settings";
import { WelcomeFlow } from "./welcome-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter the arena — Hell Blazer",
};

/**
 * First-run onboarding, shown once after the initial Google sign-in.
 *
 * Deliberately outside the (app) route group: no sidebar, no tab bar, no
 * resume banner — nothing to navigate away with until the flow is done. The
 * (app) layout redirects here whenever `profile.onboarded_at` is null.
 */
export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/");

  const [profile, unit] = await Promise.all([getProfile(), getUnit()]);
  // Already onboarded (e.g. a bookmarked /welcome) — nothing to do here.
  if (profile?.onboarded_at) redirect("/dashboard");

  // Google hands us a name and avatar; prefill so step one is usually a
  // single tap rather than typing.
  const meta = user.user_metadata ?? {};
  const suggestedName =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    "";

  return (
    <WelcomeFlow
      suggestedName={suggestedName}
      email={user.email ?? ""}
      unit={unit}
    />
  );
}

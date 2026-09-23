import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { PageTransition } from "@/components/nav/page-transition";
import { RealtimeSync } from "@/components/realtime-sync";
import { ResumeBanner } from "@/components/resume-banner";
import { getActiveSession } from "@/lib/data/sessions";
import { getShellProfile } from "@/lib/data/profile";
import { getTier } from "@/lib/tiers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, shell] = await Promise.all([requireSessionUser(), getShellProfile()]);

  // First run after Google sign-in: collect the basics before anything else.
  // /welcome lives outside this group, so there's no redirect loop.
  if (!shell.onboarded) redirect("/welcome");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const googleName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;
  const tier = getTier(shell.tier);

  return (
    <div className="relative isolate min-h-dvh">
      {/* Arena light: the accent, faint, from above. Static, and it scrolls
          away with the page; the home and profile heroes cover it. */}
      <div aria-hidden className="hb-arena-light pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem]" />
      <RealtimeSync userId={user.id} />
      <AppNav
        userEmail={user.email}
        identity={{
          name:
            shell.displayName ??
            googleName ??
            shell.ringName ??
            user.email?.split("@")[0] ??
            "Lifter",
          ringName: shell.ringName,
          tierKey: tier?.key ?? null,
          tierName: tier?.name ?? null,
          rank: tier?.rank ?? null,
        }}
      />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 min-[400px]:px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-[calc(env(safe-area-inset-bottom)+7.5rem)] sm:px-6 md:pt-12 md:pb-16 lg:px-10">
          {/* Streamed so its lookup never blocks the page content. */}
          <Suspense fallback={null}>
            <ResumeBannerSlot />
          </Suspense>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

async function ResumeBannerSlot() {
  const activeSession = await getActiveSession();
  if (!activeSession) return null;
  return <ResumeBanner session={activeSession} />;
}

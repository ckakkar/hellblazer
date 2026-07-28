import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { PageTransition } from "@/components/nav/page-transition";
import { RealtimeSync } from "@/components/realtime-sync";
import { ResumeBanner } from "@/components/resume-banner";
import { getActiveSession } from "@/lib/data/sessions";
import { isOnboarded } from "@/lib/data/profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, onboarded] = await Promise.all([
    requireSessionUser(),
    isOnboarded(),
  ]);

  // First run after Google sign-in: collect the basics before anything else.
  // /welcome lives outside this group, so there's no redirect loop.
  if (!onboarded) redirect("/welcome");

  return (
    <div className="min-h-dvh">
      {/* ambient crimson spotlight from the top — subtle arena drama */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 55% at 50% -8%, rgb(var(--accent-rgb) / 0.06), transparent 62%)",
        }}
      />
      <RealtimeSync userId={user.id} />
      <AppNav userEmail={user.email} />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 md:pt-8 md:pb-12">
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

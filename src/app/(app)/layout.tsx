import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { PageTransition } from "@/components/nav/page-transition";
import { RealtimeSync } from "@/components/realtime-sync";
import { OfflineOutbox } from "@/components/offline-outbox";
import { ResumeBanner } from "@/components/resume-banner";
import { getActiveSession } from "@/lib/data/sessions";
import { getShellProfile } from "@/lib/data/profile";
import { getTier } from "@/lib/tiers";
import { NativeBridge } from "@/components/native/native-bridge";
import { PullToRefresh } from "@/components/native/pull-to-refresh";
import { WorkoutActivitySync } from "@/components/native/workout-activity-sync";
import { LiveWorkoutProvider } from "@/components/live-workout-provider";
import { DeviceSync } from "@/components/native/device-sync";
import { getAccent, getUnit } from "@/lib/settings";
import { accentSwatch } from "@/lib/accents";
import { isIPadApp } from "@/lib/surface";
import { IPadAppProvider } from "@/components/ipad-app";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The workout under way is read with the rest, not streamed in after: the
  // banner arriving a beat after the page pushed everything under it down
  // ~90pt on every cold open. One small query, alongside the others. Failing
  // it only loses the banner.
  const [user, shell, unit, accent, ipad, activeSession] = await Promise.all([
    requireSessionUser(),
    getShellProfile(),
    getUnit(),
    getAccent(),
    isIPadApp(),
    getActiveSession().catch(() => null),
  ]);

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
  const live =
    activeSession && !activeSession.stale
      ? {
          id: activeSession.id,
          title: activeSession.title,
          startedAt: activeSession.startedAt,
          workingSets: activeSession.workingSets,
        }
      : null;

  return (
    <IPadAppProvider value={ipad}>
    <LiveWorkoutProvider value={live} read={activeSession}>
    <div className="relative isolate min-h-dvh">
      {/* Arena light: the accent, faint, from above. Static, and it scrolls
          away with the page; the home and profile heroes cover it. */}
      <div aria-hidden className="hb-arena-light pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem]" />
      <NativeBridge />
      <DeviceSync userId={user.id} unit={unit} accent={accentSwatch(accent)} />
      <PullToRefresh />
      <RealtimeSync userId={user.id} />
      <OfflineOutbox userId={user.id} />
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
        {/* From md the status bar is the only inset (an iPad's, in the app);
            it's zero in a browser. */}
        <main className="hb-ptr-content mx-auto w-full max-w-5xl px-4 min-[400px]:px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-[calc(env(safe-area-inset-bottom)+7.5rem)] sm:px-6 md:pt-[calc(env(safe-area-inset-top)+2.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+4rem)] lg:max-w-[80rem] lg:px-12">
          <WorkoutActivitySync activeSessionId={activeSession?.id ?? null} />
          {/* The iPad has no banner: its sidebar shows the workout under way. */}
          {activeSession && !ipad && <ResumeBanner session={activeSession} />}
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
    </LiveWorkoutProvider>
    </IPadAppProvider>
  );
}

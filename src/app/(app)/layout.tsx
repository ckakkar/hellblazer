import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";
import { RealtimeSync } from "@/components/realtime-sync";
import { ResumeBanner } from "@/components/resume-banner";
import { getActiveSession } from "@/lib/data/sessions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const activeSession = await getActiveSession();

  return (
    <div className="min-h-dvh">
      {/* ambient crimson spotlight from the top — subtle arena drama */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 55% at 50% -8%, rgba(255,45,58,0.06), transparent 62%)",
        }}
      />
      <RealtimeSync userId={user.id} />
      <AppNav userEmail={user.email} />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 md:pt-8 md:pb-12">
          {activeSession && <ResumeBanner session={activeSession} />}
          {children}
        </main>
      </div>
    </div>
  );
}

import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/nav/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <AppNav userEmail={user.email} />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}

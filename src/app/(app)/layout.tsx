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
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-[4.5rem] sm:px-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}

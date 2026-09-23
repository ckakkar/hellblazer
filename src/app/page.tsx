import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingArenaHero } from "@/components/tier/landing-arena-hero";
import { LandingFighterRoster } from "@/components/tier/landing-fighter-roster";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh bg-bg">
      <LandingArenaHero error={error} />
      <LandingFighterRoster />
      <footer className="flex items-center justify-between gap-4 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 text-[13px] text-muted sm:px-8 lg:px-14 xl:px-20">
        <span>Hell Blazer</span>
        <span>
          App by{" "}
          <a
            href="https://kkrwhofrags.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text underline-offset-4 hover:underline"
          >
            Cyrus
          </a>
        </span>
      </footer>
    </main>
  );
}

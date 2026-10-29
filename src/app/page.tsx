import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingArenaHero } from "@/components/tier/landing-arena-hero";
import { LandingFighterRoster } from "@/components/tier/landing-fighter-roster";
import { LandingRounds } from "@/components/tier/landing-rounds";
import { SignInOptions } from "@/components/auth/sign-in-options";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error, deleted } = await searchParams;

  return (
    // The landing is the programme's cover: printed black in either theme.
    <main className="hb-plate min-h-dvh bg-bg">
      <LandingArenaHero error={error} deleted={deleted === "1"} />
      <LandingFighterRoster />
      <LandingRounds />
      {/* The way in again, at the foot, for whoever read this far. */}
      <section className="px-5 pb-16 pt-4 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10 lg:px-14 lg:pb-24 xl:px-20">
        <div className="lg:col-span-7">
          <h2 className="font-display text-[clamp(2.25rem,10vw,3rem)] leading-[0.92] text-text lg:text-[clamp(3.5rem,5vw,5rem)]">
            Start at the bottom.
          </h2>
          <p className="mt-3 max-w-md text-[17px] leading-[1.45] text-text/70">
            Sign in, log a workout, and ask the judge where you stand.
          </p>
        </div>
        <div className="mt-6 max-w-sm lg:col-span-5 lg:mt-0 lg:justify-self-end lg:w-full">
          <SignInOptions />
        </div>
      </section>
      <footer className="flex items-center justify-between gap-4 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 text-[13px] text-muted sm:px-8 lg:px-14 xl:px-20">
        <span className="flex items-center gap-4">
          <span>Fatty</span>
          <Link href="/privacy" className="underline-offset-4 hover:text-text hover:underline">
            Privacy
          </Link>
          <Link href="/support" className="underline-offset-4 hover:text-text hover:underline">
            Support
          </Link>
        </span>
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

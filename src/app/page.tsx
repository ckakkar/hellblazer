import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingClimb } from "@/components/landing/landing-climb";
import { LandingFinale, LandingStatement } from "@/components/landing/landing-finale";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingRounds } from "@/components/landing/landing-rounds";
import "@/components/landing/landing.css";

/**
 * The landing, told as a walkout: the summit fighter's poster, the ladder
 * climbed rank by rank as the page scrolls, what the climb is made of, three
 * rounds dealt as a deck, and the bottom rung to start from. The motion is
 * scroll-driven CSS (no script per frame); without it, or with reduced
 * motion, every section sits in its final state.
 */
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
    <main className="hb-plate min-h-dvh overflow-x-clip bg-bg">
      <LandingHero error={error} deleted={deleted === "1"} />
      <LandingClimb />
      <LandingStatement />
      <LandingRounds />
      <LandingFinale />
    </main>
  );
}

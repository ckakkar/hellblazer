"use client";

import { useCallback, useState } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SplitFlapText } from "@/components/reactbits/split-flap-text";
import { FighterArt } from "@/components/tier/fighter-art";
import { TIERS } from "@/lib/tiers";

const BOARD_WIDTH = 17;
const BILL = [...TIERS].sort((a, b) => b.rank - a.rank);

function centreOnBoard(name: string) {
  const slack = Math.max(0, BOARD_WIDTH - name.length);
  const left = Math.floor(slack / 2);
  return " ".repeat(left) + name + " ".repeat(slack - left);
}

const BOARD_NAMES = BILL.map((fighter) =>
  centreOnBoard(fighter.name.toUpperCase()),
);

/** The board and portrait share one index, so the advertised fighter is real. */
export function LandingArenaHero({ error }: { error?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const showFighter = useCallback((index: number) => setActiveIndex(index), []);
  const fighter = BILL[activeIndex] ?? BILL[0];

  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 items-center pb-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,1.08fr)] lg:pb-20">
      <section className="relative z-10 min-w-0 max-w-2xl pb-2 pt-10 lg:py-24">
        <div
          className="hb-reveal flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-accent"
          style={{ animationDelay: "40ms" }}
        >
          <span className="h-px w-10 bg-accent" />
          No spectators. You&rsquo;re on the card.
        </div>

        <div
          className="hb-reveal mt-7 flex items-center gap-3"
          style={{ animationDelay: "90ms" }}
        >
          <SplitFlapText
            words={BOARD_NAMES}
            padTo={BOARD_WIDTH}
            fontSize={14}
            gap={2}
            cycleDelay={2600}
            tileColor="#1c1917"
            textColor="rgb(var(--accent-rgb))"
            onPhraseChange={showFighter}
          />
        </div>

        <h1
          className="hb-reveal mt-6 font-impact text-[clamp(3.4rem,7vw,6.35rem)] uppercase tracking-[-0.015em]"
          style={{ animationDelay: "130ms" }}
        >
          <span className="block text-[0.78em] leading-[0.94] tracking-[0.01em] text-text">
            Earn your
          </span>
          <span className="block leading-[0.84] text-accent">name in</span>
          <span className="block leading-[0.84] text-accent">blood.</span>
        </h1>

        <p
          className="hb-reveal mt-7 max-w-md text-base leading-7 text-text/75 sm:text-[17px]"
          style={{ animationDelay: "200ms" }}
        >
          Your training record becomes the fight card. Log the work, expose the
          weak points, and climb a ladder that never gives away a rung.
        </p>

        <div className="hb-reveal mt-9" style={{ animationDelay: "290ms" }}>
          {error === "auth" && (
            <p className="mb-3 max-w-sm rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              Sign-in didn&apos;t finish. Give it another go.
            </p>
          )}
          <GoogleSignIn />
          <p className="mt-3 text-xs text-text/60">
            Google sign-in only. Your log stays private to your account.
          </p>
        </div>
      </section>

      <FighterArt
        key={fighter.key}
        fighterKey={fighter.key}
        variant="hero"
        priority
        className="hb-fighter-swap relative z-0 -mx-16 -mb-6 h-[31rem] sm:-mx-8 sm:h-[38rem] lg:-mr-10 lg:ml-0 lg:h-[46rem] lg:border-y lg:border-border"
        imageClassName="scale-[1.03]"
      />
    </div>
  );
}

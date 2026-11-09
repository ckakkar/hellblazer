import Link from "next/link";
import { SignInOptions } from "@/components/auth/sign-in-options";
import { ScrollExpand } from "@/components/reactbits/scroll-expand";
import { ScrollFloat } from "@/components/reactbits/scroll-float";
import { ScrollReveal } from "@/components/reactbits/scroll-reveal";
import { FighterArt } from "@/components/tier/fighter-art";

/** The line between the ladder and the rounds: what the climb is made of, lit word by word. */
export function LandingStatement() {
  return (
    <section aria-label="How the ladder works" className="px-5 py-[16svh] sm:px-8 lg:px-14 lg:py-[22svh] xl:px-20">
      <ScrollReveal
        as="p"
        text="Every set you log is on the record. Last time's numbers sit beside today's, the judge reads all of it, and you decide whether to take the verdict."
        className="max-w-[22ch] text-[clamp(2rem,8.6vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-text sm:max-w-[26ch] lg:max-w-[30ch] lg:text-[clamp(3rem,4.6vw,4.75rem)]"
      />
    </section>
  );
}

/**
 * The foot of the page bookends the poster at the top: the summit opened it,
 * and the bottom rung closes it, its frame opening out to full bleed as it
 * arrives, under the one instruction there is. Then the way in, again, for
 * whoever read this far.
 */
export function LandingFinale() {
  return (
    <>
      <section aria-label="Start" className="pt-[4svh]">
        <ScrollExpand className="lp-finale-frame">
          <div className="hb-plate relative isolate h-[88svh] min-h-[30rem] overflow-hidden bg-bg [--hb-fade:var(--color-bg)] lg:h-[96svh]">
            <FighterArt fighterKey="rei" variant="hero" fade="bottom" className="absolute inset-0 -z-10 lg:left-[30%]" />
            <div aria-hidden className="lp-finale-edge absolute inset-0 -z-10 hidden lg:block" />
            <div className="flex h-full flex-col justify-end px-5 pb-[8svh] sm:px-8 lg:px-14 lg:pb-[12svh] xl:px-20">
              <p className="text-[15px] text-text/70">Rank 1 of 10. Rei Mikazuchi, the Lightning God.</p>
              <ScrollFloat
                as="h2"
                text={"Start at\nthe bottom."}
                className="mt-3 font-display text-[clamp(3.4rem,16vw,5rem)] leading-[0.88] text-text lg:text-[clamp(6rem,8.4vw,10rem)] lg:leading-[0.84]"
              />
            </div>
          </div>
        </ScrollExpand>
      </section>

      <section aria-label="Sign in" className="px-5 pb-16 pt-12 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10 lg:px-14 lg:pb-24 lg:pt-16 xl:px-20">
        <p className="max-w-md text-[19px] leading-[1.4] text-text/80 lg:col-span-7 lg:text-[22px]">
          Sign in, log a workout, and ask the judge where you stand.
        </p>
        <div className="mt-6 max-w-sm lg:col-span-5 lg:mt-0 lg:w-full lg:justify-self-end">
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
    </>
  );
}

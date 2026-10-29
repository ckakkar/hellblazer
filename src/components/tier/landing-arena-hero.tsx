import { Flame } from "lucide-react";
import { SignInOptions } from "@/components/auth/sign-in-options";
import { FighterArt } from "@/components/tier/fighter-art";

/**
 * The landing's opening screen, a fight poster: the summit fighter's portrait
 * full-bleed, his rank cut huge in outline over it with who he is, and the
 * headline, one sentence and the sign-in across the foot on phones and down
 * the left on desktop, running out over the portrait's faded edge.
 */
export function LandingArenaHero({ error, deleted }: { error?: string; deleted?: boolean }) {
  return (
    <section className="relative lg:grid lg:min-h-dvh lg:grid-cols-12 lg:items-center">
      <div className="hb-landing-art hb-hero-art relative h-[64dvh] min-h-[27rem] overflow-hidden lg:col-[6/-1] lg:row-start-1 lg:h-dvh">
        <FighterArt
          fighterKey="kuroki"
          variant="hero"
          priority
          fade="bottom"
          className="absolute inset-0"
        />
        {/* The accent's light behind his shoulder: the summit is the one lit thing. */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-screen"
          style={{ background: "radial-gradient(55% 45% at 72% 22%, rgb(var(--accent-rgb) / 0.2), transparent 70%)" }}
        />
        <header className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] lg:hidden">
          <Flame className="size-5 text-accent" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">Fatty</span>
        </header>
        {/* Who's on the poster: the top of the ladder, his number in outline. */}
        <div className="absolute right-5 top-[calc(env(safe-area-inset-top)+3.25rem)] text-right sm:right-8 lg:bottom-14 lg:right-14 lg:top-auto xl:right-20">
          <span
            aria-hidden
            className="hb-hero-rise tnum font-display block text-[6.5rem] leading-[0.8] text-transparent [-webkit-text-stroke:1.5px_rgb(var(--accent-rgb))] lg:text-[11rem] lg:[-webkit-text-stroke:2px_rgb(var(--accent-rgb))]"
            style={{ animationDelay: "240ms" }}
          >
            10
          </span>
          <p className="hb-hero-rise mt-2 text-[13px] leading-5 text-text/75 lg:mt-3 lg:text-[14px]" style={{ animationDelay: "300ms" }}>
            Kuroki Gensai, the Devil Lance.
            <br />
            The top of the ladder.
          </p>
        </div>
      </div>

      <div className="relative -mt-32 px-5 pb-12 sm:px-8 lg:z-10 lg:col-[1/9] lg:row-start-1 lg:mt-0 lg:px-14 lg:py-16 xl:px-20">
        <div className="mb-10 hidden items-center gap-2 lg:flex">
          <Flame className="size-5 text-accent" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">Fatty</span>
        </div>
        <h1
          className="hb-hero-rise font-display text-[clamp(3.25rem,16vw,4.5rem)] leading-[0.9] text-text sm:text-7xl lg:text-[clamp(5.5rem,7.6vw,9rem)] lg:leading-[0.86]"
          style={{ animationDelay: "60ms" }}
        >
          Earn your
          <br />
          rank.
        </h1>
        <p
          className="hb-hero-rise mt-5 max-w-md text-[17px] leading-[1.45] text-text/70 lg:mt-7 lg:text-[19px]"
          style={{ animationDelay: "120ms" }}
        >
          A strength log with a ten-fighter ladder. Log every set, and the judge
          decides where you stand.
        </p>
        <div className="hb-hero-rise mt-8 max-w-sm lg:mt-10" style={{ animationDelay: "180ms" }}>
          {deleted && (
            <p className="mb-3 rounded-xl bg-surface px-4 py-3 text-[14px] text-text">
              Your account and everything in it has been deleted.
            </p>
          )}
          {error === "auth" && (
            <p className="mb-3 rounded-xl bg-danger/10 px-4 py-3 text-[14px] text-danger">
              Sign-in didn&apos;t finish. Try again.
            </p>
          )}
          <SignInOptions
            webNote={
              <p className="mt-3 text-[13px] leading-5 text-muted">
                Joined with Apple on your iPhone? Link Google in the app&apos;s Profile to sign in here.
              </p>
            }
          />
          <p className="mt-2 text-[13px] leading-5 text-muted">Private to you. Keeps logging with no signal.</p>
        </div>
      </div>
    </section>
  );
}

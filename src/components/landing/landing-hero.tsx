import { Flame } from "lucide-react";
import { SignInOptions } from "@/components/auth/sign-in-options";
import { SplitText } from "@/components/reactbits/split-text";
import { FighterArt } from "@/components/tier/fighter-art";

/**
 * The landing's opening shot, a fight poster: the summit fighter full-bleed,
 * his rank cut huge in outline, the headline set letter by letter as the page
 * opens, and the way in. Scrolling away is the walkout starting: the camera
 * pushes into him while the headline splits apart and the poster darkens
 * into the climb (landing.css, "Hero"). Every move is a scroll-driven CSS
 * animation; without them the poster simply stays put.
 */
export function LandingHero({ error, deleted }: { error?: string; deleted?: boolean }) {
  return (
    <section aria-labelledby="hero-title" className="lp-hero relative isolate overflow-clip">
      {/* The portrait: full-bleed on a phone, the right of the poster on a desktop. */}
      <div aria-hidden className="lp-hero-art absolute inset-0 -z-10 lg:left-[38%]">
        <div className="lp-hero-push absolute inset-0">
          <div className="lp-hero-in absolute inset-0">
            <FighterArt fighterKey="kuroki" variant="hero" priority fade="bottom" className="absolute inset-0" />
          </div>
        </div>
        {/* The accent's light behind his shoulder: the summit is the one lit thing. */}
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{ background: "radial-gradient(55% 45% at 70% 22%, rgb(var(--accent-rgb) / 0.22), transparent 70%)" }}
        />
        <div className="lp-hero-edge absolute inset-0 hidden lg:block" />
        <div className="lp-hero-shade absolute inset-0 bg-bg" />
      </div>

      <header className="relative flex items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 lg:px-14 lg:pt-10 xl:px-20">
        <Flame className="size-5 text-accent" strokeWidth={2.25} />
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">Fatty</span>
      </header>

      {/* Who's on the poster: the top of the ladder, his number in outline. */}
      <div
        aria-hidden
        className="lp-hero-rank pointer-events-none absolute right-5 top-[calc(env(safe-area-inset-top)+3.5rem)] text-right sm:right-8 lg:bottom-[12svh] lg:right-14 lg:top-auto xl:right-20"
      >
        <div className="lp-hero-rank-in">
          <span className="tnum font-display block text-[7rem] leading-[0.8] text-transparent [-webkit-text-stroke:1.5px_rgb(var(--accent-rgb))] lg:text-[13rem] lg:[-webkit-text-stroke:2px_rgb(var(--accent-rgb))]">
            10
          </span>
          <p className="mt-2 text-[13px] leading-5 text-text/75 lg:mt-3 lg:text-[14px]">
            Kuroki Gensai, the Devil Lance.
            <br />
            The top of the ladder.
          </p>
        </div>
      </div>

      <div className="lp-hero-body relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-end px-5 pb-10 pt-[38svh] sm:px-8 lg:min-h-[calc(100svh-5.5rem)] lg:max-w-[56rem] lg:justify-center lg:px-14 lg:pb-[10svh] lg:pt-10 xl:px-20">
        <h1
          id="hero-title"
          className="font-display text-[clamp(3.6rem,18vw,5.25rem)] leading-[0.88] text-text lg:text-[clamp(6rem,8.6vw,10.5rem)] lg:leading-[0.84]"
        >
          <span className="sr-only">Earn your rank.</span>
          <span aria-hidden className="lp-hero-split-l block">
            <SplitText text="Earn your" delayMs={80} />
          </span>
          <span aria-hidden className="lp-hero-split-r block">
            <SplitText text="rank." delayMs={330} />
          </span>
        </h1>
        <div className="lp-hero-copy">
          <p className="lp-hero-up mt-5 max-w-md text-[17px] leading-[1.45] text-text/75 lg:mt-7 lg:text-[19px]">
            A strength log with a ten-fighter ladder. Log every set, and the judge decides where you stand.
          </p>
          <div className="lp-hero-up mt-8 max-w-sm lg:mt-10" style={{ animationDelay: "560ms" }}>
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
      </div>

      {/* Where the page goes from here; it fills as the poster leaves. */}
      <div aria-hidden className="lp-hero-cue pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 hidden items-center gap-3 text-[13px] text-muted sm:right-8 lg:flex lg:right-14 xl:right-20">
        <span>Scroll to climb the ladder</span>
        <span className="relative h-px w-16 overflow-hidden bg-text/15">
          <span className="lp-hero-cue-fill absolute inset-0 origin-left bg-text/70" />
        </span>
      </div>
    </section>
  );
}

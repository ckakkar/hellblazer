import { Flame } from "lucide-react";
import { SignInOptions } from "@/components/auth/sign-in-options";
import { FighterArt } from "@/components/tier/fighter-art";

/**
 * The landing's opening screen. The summit fighter's portrait is the one
 * bold thing; the headline, one sentence and the sign-in button sit beneath
 * it on phones and beside it on desktop.
 */
export function LandingArenaHero({ error, deleted }: { error?: string; deleted?: boolean }) {
  return (
    <section className="relative lg:grid lg:min-h-dvh lg:grid-cols-2 lg:items-center">
      <div className="relative h-[62dvh] min-h-[26rem] overflow-hidden lg:order-2 lg:h-dvh">
        <FighterArt
          fighterKey="kuroki"
          variant="hero"
          priority
          fade="bottom"
          className="absolute inset-0"
          imageClassName="object-[center_18%]"
        />
        <header className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] lg:hidden">
          <Flame className="size-5 text-accent" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">Fatty</span>
        </header>
      </div>

      <div className="relative -mt-28 px-5 pb-10 sm:px-8 lg:mt-0 lg:px-14 lg:py-16 xl:px-20">
        <div className="mb-10 hidden items-center gap-2 lg:flex">
          <Flame className="size-5 text-accent" strokeWidth={2.25} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-text">Fatty</span>
        </div>
        <h1 className="font-display text-[3.25rem] leading-[0.95] text-text sm:text-7xl">
          Earn your rank.
        </h1>
        <p className="mt-4 max-w-md text-[17px] leading-[1.45] text-muted">
          A strength log with a ten-fighter ladder. Log every set, and the judge
          decides where you stand.
        </p>
        <div className="mt-8 max-w-sm">
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
          <SignInOptions />
          <p className="mt-3 text-center text-[13px] text-muted sm:text-left">
            Private to you. Works offline.
          </p>
        </div>
      </div>
    </section>
  );
}

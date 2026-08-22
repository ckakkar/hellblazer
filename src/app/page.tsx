import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { BlurText } from "@/components/reactbits/blur-text";
import { SplitFlapText } from "@/components/reactbits/split-flap-text";
import { ScrollReveal } from "@/components/reactbits/scroll-reveal";
import { TIERS } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

/** Widest fighter name ("Wakatsuki Takeshi" / "Gaolang Wongsawat") sets the board. */
const BOARD_WIDTH = 17;

/** Centre a name in the fixed board width so blanks fall either side of it. */
function centreOnBoard(name: string) {
  const slack = Math.max(0, BOARD_WIDTH - name.length);
  const left = Math.floor(slack / 2);
  return " ".repeat(left) + name + " ".repeat(slack - left);
}

const BOARD_NAMES = [...TIERS]
  .sort((a, b) => b.rank - a.rank)
  .map((t) => centreOnBoard(t.name.toUpperCase()));

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  // Kuroki (rank 9) on top, Rei (rank 1) at the floor.
  const ladder = [...TIERS].sort((a, b) => b.rank - a.rank);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <header className="flex items-center gap-2 py-7">
          <span className="flex size-6 items-center justify-center rounded-md border border-accent/40 text-accent">
            <Flame className="size-3.5" />
          </span>
          <span className="hb-shiny font-display text-sm font-semibold uppercase tracking-[0.22em]">
            Hell&nbsp;Blazer
          </span>
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-12 pb-16 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-24">
          {/* ── Pitch ─────────────────────────────────────────────── */}
          <section className="min-w-0 max-w-xl">
            <div
              className="hb-reveal font-mono text-[11px] uppercase tracking-[0.2em] text-muted"
              style={{ animationDelay: "40ms" }}
            >
              Tonight&rsquo;s card
            </div>

            {/* React Bits SplitFlapText: a departure board naming the fighters
                one at a time, strongest first. Sits above the headline rather
                than between it and the pitch, where it broke the read. Names
                are centre-padded to a fixed 17 tiles so the board never
                resizes and its blanks look like board furniture instead of
                dead cells trailing off the end. */}
            <div
              className="hb-reveal mt-6 flex items-center gap-3"
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
              />
            </div>

            {/* React Bits BlurText: the words resolve out of a blur, one by
                one. Two stacked lines rather than a <br/> so each animates as
                its own run while staying inside a single <h1>. */}
            <h1 className="mt-5 font-impact text-[2.5rem] uppercase leading-[0.92] tracking-tight text-text sm:text-6xl lg:text-7xl">
              <BlurText as="div" text="Ten fighters" animateBy="words" delay={110} />
              <BlurText
                as="div"
                text="stand above you."
                animateBy="words"
                delay={110}
                className="text-accent"
              />
            </h1>

            <p
              className="hb-reveal mt-7 max-w-md text-base leading-7 text-muted sm:text-[17px]"
              style={{ animationDelay: "200ms" }}
            >
              Every set you log goes on the tape: tonnage, working sets,
              estimated 1RM. Your numbers get weighed against ten of the
              deadliest fighters in the ring, and you climb only when they say
              you&rsquo;ve earned it.
            </p>

            <div className="hb-reveal mt-9" style={{ animationDelay: "290ms" }}>
              {error === "auth" && (
                <p className="mb-3 max-w-sm rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  Sign-in didn&apos;t finish. Give it another go.
                </p>
              )}
              <GoogleSignIn />
              <p className="mt-3 text-xs text-muted">
                Google sign-in only. Your log stays private to your account.
              </p>
            </div>
          </section>

          {/* ── Signature: the ascension ladder ───────────────────── */}
          <section
            className="hb-reveal relative"
            style={{ animationDelay: "180ms" }}
            aria-label={`The bill: ${TIERS.length} fighters, main event first down to rank 1`}
          >
            {/* The bill. Ten names in bout order, top of the card first — the
                artefact this whole app is themed on. The old version wrapped it
                in a spotlight card and hung a progress bar off every rung, but
                a bar whose width just restates the rank number beside it is
                decoration; the running order is the information, so the list is
                set as a bill and the bars are gone. */}
            <div className="flex items-baseline justify-between border-b border-text/85 pb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                The bill
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Main event first
              </span>
            </div>

            <ol>
              {ladder.map((t, i) => {
                const top = t.rank === TIERS.length;
                return (
                  <li
                    key={t.key}
                    className={cn(
                      "flex items-baseline gap-3 border-b border-border py-2.5",
                      top && "border-b-text/30",
                    )}
                  >
                    <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-muted">
                      {String(t.rank).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-impact uppercase leading-none",
                        top ? "text-2xl text-accent" : "text-lg text-text",
                      )}
                    >
                      {t.name}
                    </span>
                    <span
                      className={cn(
                        "hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] sm:block",
                        top ? "text-accent" : "text-muted",
                      )}
                    >
                      {i === 0 ? "Main event" : t.epithet}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Blur off here: this sits at the very bottom of a long page and
                the passage is short, so the fade alone carries it. */}
            <ScrollReveal
              enableBlur={false}
              baseRotation={0}
              className="mt-4 text-[13px] leading-6 text-muted"
            >
              {`You start off the card entirely. Log real sets, get weighed in, and take a rung off somebody.`}
            </ScrollReveal>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border py-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted">
            <span>Program blocks</span>
            <span className="text-border">·</span>
            <span>Copy-forward logging</span>
            <span className="text-border">·</span>
            <span>Est. 1RM &amp; tonnage</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wide text-muted">
            App by{" "}
            <a
              href="https://kkrwhofrags.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              Cyrus
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

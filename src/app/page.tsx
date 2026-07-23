import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { TIERS } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

// Terse ladder tags — the destination and the floor are labelled; the rungs
// between just carry a name and a rising strength bar.
const RUNG_TAG: Record<string, string> = {
  kuroki: "最強 · the devil lance",
  rei: "where everyone starts",
};

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
      {/* one restrained heat-source: a crimson glow behind the ladder */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[-10%] h-[620px] w-[620px] rounded-full opacity-50 blur-[130px] sm:opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.20), transparent)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <header className="flex items-center gap-2 py-7">
          <span className="flex size-6 items-center justify-center rounded-md border border-accent/40 text-accent">
            <Flame className="size-3.5" />
          </span>
          <span className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-text">
            Hell&nbsp;Blazer
          </span>
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-12 pb-16 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pb-24">
          {/* ── Pitch ─────────────────────────────────────────────── */}
          <section className="min-w-0 max-w-xl">
            <div
              className="hb-reveal flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em] text-muted"
              style={{ animationDelay: "40ms" }}
            >
              <span className="text-accent">力</span>
              <span className="h-px w-8 bg-border" />
              The strength ladder
            </div>

            <h1
              className="hb-reveal mt-6 font-impact text-[2.5rem] uppercase leading-[0.92] tracking-tight text-text sm:text-6xl lg:text-7xl"
              style={{ animationDelay: "110ms" }}
            >
              Ten fighters
              <br />
              <span className="text-accent">stand above you.</span>
            </h1>

            <p
              className="hb-reveal mt-7 max-w-md text-base leading-7 text-muted sm:text-lg"
              style={{ animationDelay: "200ms" }}
            >
              Log every set like it counts. Your numbers get weighed and ranked
              against the deadliest fighters in the ring — climb from Rei to
              Kuroki, one honest rep at a time.
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
            aria-label={`The strength ladder — rank ${TIERS.length} down to rank 1`}
          >
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface/60 p-3 backdrop-blur-sm sm:p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Rank ladder
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {String(TIERS.length).padStart(2, "0")} → 01
                </span>
              </div>

              <ol className="space-y-1">
                {ladder.map((t) => {
                  const top = t.rank === TIERS.length;
                  const pct = Math.round((t.rank / TIERS.length) * 100);
                  const tag = RUNG_TAG[t.key];
                  return (
                    <li
                      key={t.key}
                      className="hb-reveal"
                      style={{ animationDelay: `${(t.rank - 1) * 45 + 260}ms` }}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2",
                          top && "bg-accent/[0.07] shadow-glow",
                        )}
                      >
                        <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
                          {String(t.rank).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "truncate font-impact uppercase leading-none tracking-tight",
                                top ? "text-lg text-accent" : "text-sm text-text",
                              )}
                              style={
                                top
                                  ? undefined
                                  : {
                                      opacity:
                                        0.45 + (0.55 * t.rank) / TIERS.length,
                                    }
                              }
                            >
                              {t.name}
                            </span>
                            {tag && (
                              <span
                                className={cn(
                                  "hidden shrink-0 font-mono text-[10px] tracking-wide sm:block",
                                  top ? "text-accent/80" : "text-muted/70",
                                )}
                              >
                                {tag}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{
                                width: `${pct}%`,
                                opacity: 0.3 + (0.7 * t.rank) / TIERS.length,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="mt-3 px-1 text-[11px] leading-5 text-muted">
                You enter unranked. Earn your rung, then keep climbing — there is
                always someone stronger.
              </p>
            </div>
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

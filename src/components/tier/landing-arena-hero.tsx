import {
  Activity,
  CloudOff,
  Dumbbell,
  ShieldCheck,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SplitFlapText } from "@/components/reactbits/split-flap-text";
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

const TRAINING_TOOLS = [
  { icon: TimerReset, label: "Rest clock", detail: "Ready when you are" },
  {
    icon: TrendingUp,
    label: "Progressive load",
    detail: "Beat the last session",
  },
  { icon: CloudOff, label: "Offline logging", detail: "Sets save on device" },
  {
    icon: ShieldCheck,
    label: "Private record",
    detail: "Only you see the work",
  },
] as const;

export function LandingArenaHero({ error }: { error?: string }) {
  return (
    <section className="relative isolate py-10 sm:py-14 lg:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-20 -z-10 size-[34rem] rounded-full bg-accent/[0.075] blur-[120px]"
      />

      <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[minmax(0,1.06fr)_minmax(27rem,0.94fr)] lg:gap-16 xl:gap-24">
        <div className="min-w-0 max-w-3xl">
          <div
            className="hb-reveal flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-accent"
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
            />
          </div>

          <h1
            className="hb-reveal mt-6 max-w-[9ch] text-balance font-impact text-[clamp(4rem,8vw,7.9rem)] uppercase leading-[0.78] tracking-[-0.025em]"
            style={{ animationDelay: "130ms" }}
          >
            <span className="block text-text">Earn your</span>
            <span className="block text-accent">name in blood.</span>
          </h1>

          <p
            className="hb-reveal mt-7 max-w-xl text-pretty text-base leading-7 text-text/70 sm:text-lg sm:leading-8"
            style={{ animationDelay: "200ms" }}
          >
            A strength log built like a fight camp. Run the program, record the
            work, expose weak points, and earn the next rung.
          </p>

          <div className="hb-reveal mt-9" style={{ animationDelay: "290ms" }}>
            {error === "auth" && (
              <p className="mb-3 max-w-sm rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                Sign-in didn&apos;t finish. Give it another go.
              </p>
            )}
            <GoogleSignIn />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-accent" /> Private by default
              </span>
              <span className="hidden size-1 rounded-full bg-border sm:block" />
              <span className="flex items-center gap-1.5">
                <CloudOff className="size-3.5 text-accent" /> Offline ready
              </span>
            </div>
          </div>
        </div>

        <div
          className="hb-command-deck hb-reveal relative overflow-hidden rounded-[1.75rem] border border-text/10 p-3 shadow-raised sm:p-4"
          style={{ animationDelay: "180ms" }}
          aria-label="Training workflow preview"
        >
          <div className="relative z-10 flex items-center justify-between px-2 pb-4 pt-1">
            <div>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted">
                Training console
              </p>
              <p className="mt-1 font-display text-lg uppercase tracking-[0.04em] text-text">
                Session in progress
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.07] px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-accent">
              <span className="hb-live-pulse size-1.5 rounded-full bg-accent" /> Live
            </span>
          </div>

          <div className="relative z-10 overflow-hidden rounded-[1.35rem] border border-text/10 bg-bg/75 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-accent">
                  <Dumbbell className="size-3.5" /> Active set
                </div>
                <h2 className="mt-3 font-display text-2xl uppercase tracking-[0.025em] text-text sm:text-3xl">
                  Bench press
                </h2>
                <p className="mt-1.5 text-sm text-muted">Working set 3 of 4</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent">
                <Activity className="size-5" />
              </span>
            </div>

            <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-y border-border/70 py-5">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  Load
                </p>
                <p className="mt-1 font-impact text-4xl leading-none tabular-nums text-text sm:text-5xl">
                  82.5 <span className="font-mono text-xs text-muted">kg</span>
                </p>
              </div>
              <span className="pb-1 font-impact text-3xl text-muted/35">×</span>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  Reps
                </p>
                <p className="mt-1 font-impact text-4xl leading-none tabular-nums text-accent sm:text-5xl">
                  06
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                <span>Session progress</span>
                <span className="text-text">58%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span className="hb-console-progress block h-full w-[58%] rounded-full bg-accent" />
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
            {TRAINING_TOOLS.map(({ icon: Icon, label, detail }) => (
              <div
                key={label}
                className="rounded-2xl border border-text/[0.07] bg-bg/45 p-3.5 backdrop-blur-sm transition-colors hover:border-accent/25 hover:bg-surface/80 sm:p-4"
              >
                <Icon className="size-4 text-accent" />
                <p className="mt-3 text-sm font-semibold tracking-[-0.01em] text-text">
                  {label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

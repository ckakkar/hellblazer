"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Play, X } from "lucide-react";
import { discardSession } from "@/lib/actions/sessions";
import type { ActiveSession } from "@/lib/data/sessions";
import { formatElapsed, STALE_CLOCK_MS } from "@/lib/workout-clock";

/**
 * The workout's running clock, ticking once a second. Null until mounted (the
 * server and the phone would disagree on the time), and for a session left
 * open so long it isn't a workout any more.
 */
function useElapsed(startedAt: string): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return null;
  const ms = now - new Date(startedAt).getTime();
  return ms >= 0 && ms <= STALE_CLOCK_MS ? formatElapsed(ms) : null;
}

export function ResumeBanner({ session }: { session: ActiveSession }) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const elapsed = useElapsed(session.startedAt);

  // Don't nag while you're already in that workout.
  if (pathname === `/log/${session.id}`) return null;

  const discard = () =>
    start(async () => void (await discardSession({ id: session.id })));

  return (
    <div className="hb-resume mb-6 flex items-center gap-3 rounded-2xl max-[359px]:gap-2.5 bg-surface py-3 pl-4 pr-2">
      <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-text">
          {session.title ?? "Workout"}
        </div>
        <div className="tnum truncate text-[13px] text-muted">
          {elapsed ? (
            <>
              <span className="text-accent-ink">{elapsed}</span>, {session.workingSets}{" "}
              {session.workingSets === 1 ? "set" : "sets"} logged
            </>
          ) : (
            <>
              In progress, {session.workingSets} {session.workingSets === 1 ? "set" : "sets"} logged
            </>
          )}
        </div>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={discard}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-danger/10 px-3 text-[14px] font-medium text-danger"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Discard
          </button>
          <button
            onClick={() => setConfirming(false)}
            aria-label="Keep workout"
            className="flex size-9 items-center justify-center rounded-full text-muted hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Prefetched in full: mid-workout, this is the way back to the
              logger from every other tab, so it opens at once. */}
          <Link
            href={`/log/${session.id}`}
            prefetch
            transitionTypes={["nav-forward"]}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-black active:opacity-80 max-[359px]:w-11 max-[359px]:justify-center max-[359px]:px-0"
          >
            <Play className="size-3.5" />
            {/* On the narrowest phones the title needs the room more. */}
            <span className="max-[359px]:sr-only">Resume</span>
          </Link>
          <button
            onClick={() => setConfirming(true)}
            aria-label="Discard workout"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:text-danger"
          >
            <X className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

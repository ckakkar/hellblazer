"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Play, X } from "lucide-react";
import { discardSession } from "@/lib/actions/sessions";
import type { ActiveSession } from "@/lib/data/sessions";

export function ResumeBanner({ session }: { session: ActiveSession }) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // Don't nag while you're already in that workout.
  if (pathname === `/log/${session.id}`) return null;

  const discard = () =>
    start(async () => void (await discardSession({ id: session.id })));

  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/[0.07] px-4 py-3">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent">
          Battle in progress
        </div>
        <div className="truncate text-sm text-text">
          {session.title ?? "Workout"}
          <span className="ml-1 font-mono text-xs text-muted">
            · {session.workingSets} sets logged
          </span>
        </div>
      </div>
      <Link
        href={`/log/${session.id}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg shadow-glow transition-transform active:scale-95"
      >
        <Play className="size-4" />
        Resume
      </Link>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={discard}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/25"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Discard
          </button>
          <button
            onClick={() => setConfirming(false)}
            aria-label="Keep workout"
            className="text-muted transition-colors hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label="Discard workout"
          className="shrink-0 text-muted transition-colors hover:text-danger"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

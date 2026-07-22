"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Play, X } from "lucide-react";
import { discardSession } from "@/lib/actions/sessions";
import type { ActiveSession } from "@/lib/data/sessions";

export function ResumeBanner({ session }: { session: ActiveSession }) {
  const pathname = usePathname();
  const [pending, start] = useTransition();

  // Don't nag while you're already in that workout.
  if (pathname === `/log/${session.id}`) return null;

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
      <button
        onClick={() => start(async () => void (await discardSession({ id: session.id })))}
        disabled={pending}
        aria-label="Discard workout"
        className="shrink-0 text-muted transition-colors hover:text-danger"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <X className="size-4" />
        )}
      </button>
    </div>
  );
}

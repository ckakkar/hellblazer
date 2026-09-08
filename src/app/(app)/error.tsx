"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; transient auth/clock-skew errors land here.
    console.error(error);
  }, [error]);

  return (
    <div className="hb-panel-cut relative flex min-h-[60dvh] flex-col items-start justify-end overflow-hidden border-y-2 border-text/80 bg-surface/50 px-6 py-10 text-left sm:px-10">
      <span aria-hidden className="absolute -right-4 -top-12 font-impact text-[14rem] leading-none text-text/[0.025]">ERR</span>
      <div className="flex size-12 items-center justify-center border border-danger/30 bg-danger/5 text-danger">
        <TriangleAlert className="size-5" />
      </div>
      <div className="mt-6 font-mono text-[9px] uppercase tracking-[0.24em] text-danger">Connection fault</div>
      <h1 className="mt-2 font-impact text-5xl uppercase leading-[0.82] text-text sm:text-6xl">
        Something didn&apos;t load
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">
        A temporary hiccup talking to the server, usually a one-off. Try again.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" />
          Try again
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[11px] text-muted/60">
          ref {error.digest}
        </p>
      )}
    </div>
  );
}

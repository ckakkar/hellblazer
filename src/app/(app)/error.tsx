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
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border bg-surface text-muted">
        <TriangleAlert className="size-5" />
      </div>
      <h1 className="mt-5 font-display text-xl font-semibold tracking-tight text-text">
        Something didn&apos;t load
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        A temporary hiccup talking to the server — usually a one-off. Try again.
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

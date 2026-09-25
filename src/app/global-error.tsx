"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import "./globals.css";

/**
 * The last line: the root layout itself threw, so this renders its own
 * document. No app font here (it's loaded by the layout that failed); the
 * system face is fine for one screen.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // Re-fetches the segment and re-renders; `reset` only re-renders, which
  // just throws the same server error again.
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-text antialiased">
        <title>Fatty</title>
        <ErrorState digest={error.digest} onRetry={retry} fullScreen />
      </body>
    </html>
  );
}

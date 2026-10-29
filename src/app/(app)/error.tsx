"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { reportProblem } from "@/lib/report";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  // Re-fetches the segment and re-renders; `reset` only re-renders, which
  // just throws the same server error again.
  retry: () => void;
}) {
  useEffect(() => {
    // Surface for observability; transient auth/clock-skew errors land here.
    console.error(error);
    // The digest ties it to the server's own log line, without the message.
    reportProblem("render-error", error.digest);
  }, [error]);

  return <ErrorState digest={error.digest} onRetry={retry} />;
}

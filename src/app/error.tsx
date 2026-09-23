"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

/** Routes outside the app shell: the landing page and /welcome. */
export default function RootError({
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

  return <ErrorState digest={error.digest} onRetry={retry} fullScreen />;
}

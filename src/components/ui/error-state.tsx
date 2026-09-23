import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What a route shows when it throws. Calm and plainly worded: nearly every
 * failure here is a dropped connection or a server hiccup, and a retry fixes
 * it. The reference is the server's error digest, for matching a report to
 * the logs.
 */
export function ErrorState({
  digest,
  onRetry,
  fullScreen = false,
}: {
  digest?: string;
  onRetry: () => void;
  /** Outside the app shell (landing, welcome, root layout) it fills the screen. */
  fullScreen?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        fullScreen ? "min-h-dvh" : "min-h-[62dvh]",
      )}
    >
      <h1 className="font-display text-[2rem] leading-tight text-text sm:text-[2.5rem]">
        Something didn&apos;t load
      </h1>
      <p className="mt-2 max-w-sm text-[15px] leading-[1.5] text-muted">
        Usually a one-off hiccup reaching the server. Give it another go.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={onRetry}>
          <RotateCw className="size-4" />
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Dashboard
        </Link>
      </div>
      {digest && <p className="tnum mt-8 text-[13px] text-muted/70">Reference {digest}</p>}
    </div>
  );
}

import { cn } from "@/lib/utils";

/** A single themed skeleton block (accent shimmer on a surface fill). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("hb-skeleton rounded-md", className)} />;
}

/** The page title + subtitle + action placeholder every screen shares. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-9 w-44 rounded-lg sm:w-56" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      {action && <Skeleton className="h-10 w-32 shrink-0 rounded-lg" />}
    </div>
  );
}

/** A themed card-shaped skeleton (bordered surface with a shimmer body). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "hb-skeleton rounded-lg border border-border/70",
        className,
      )}
    />
  );
}

import { cn } from "@/lib/utils";

/**
 * Placeholder block for route-level loading UI.
 *
 * These are all server components on purpose: `loading.tsx` is the very first
 * thing the App Router streams for a navigation, so it should not wait on a
 * client bundle to paint. Motion comes from `.hb-skeleton` in globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("hb-skeleton rounded-md", className)} />;
}

/**
 * Indeterminate hairline pinned to the top of the viewport. Signals "a
 * navigation is in flight" without blanking the screen, the way a full-page
 * loader does.
 */
export function RouteProgress() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden"
    >
      <div className="hb-route-bar h-full w-full bg-accent" />
    </div>
  );
}

/**
 * Shared shell for every route skeleton: the progress hairline, a stand-in for
 * `PageHeader`, and whatever placeholder body the route passes in. `aria-busy`
 * plus a polite live-region label keeps screen readers informed, since the
 * blocks themselves are `aria-hidden`.
 */
export function PageSkeleton({
  children,
  label = "Loading",
  narrow = false,
  action = false,
}: {
  children?: React.ReactNode;
  label?: string;
  /** Match the routes that constrain themselves to `max-w-2xl` (e.g. /log). */
  narrow?: boolean;
  /** Reserve space for a header-right action button. */
  action?: boolean;
}) {
  return (
    <div aria-busy="true" className={cn(narrow && "mx-auto max-w-2xl")}>
      <RouteProgress />
      <span className="sr-only" role="status">
        {label}
      </span>

      {/* PageHeader stand-in: title + subtitle at the real type sizes. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-52 sm:h-9 sm:w-64" />
          <Skeleton className="mt-2.5 h-4 w-64 sm:w-80" />
        </div>
        {action && <Skeleton className="h-10 w-32 rounded-lg" />}
      </div>

      {children}
    </div>
  );
}

/** A stack of card-shaped rows, sized like the app's list items. */
export function ListSkeleton({
  rows = 5,
  height = "h-[74px]",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("rounded-xl", height)}
          // Fade the tail: rows further down are less likely to be seen before
          // the real data lands, so they shouldn't shout as loudly.
        />
      ))}
    </div>
  );
}

/** Chart card placeholder: title line above a plot-sized block. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-card",
        className,
      )}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-1.5 h-3 w-28" />
      <Skeleton className="mt-5 h-48 w-full rounded-lg" />
    </div>
  );
}

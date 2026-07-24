import { PageHeaderSkeleton, CardSkeleton } from "@/components/ui/skeleton";

/** Generic themed fallback — used by any screen without its own loading state. */
export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton />
      <div className="grid gap-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-44" />
        <CardSkeleton className="h-44" />
      </div>
    </div>
  );
}

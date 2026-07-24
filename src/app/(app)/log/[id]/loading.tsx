import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <span className="sr-only">Loading workout…</span>
      <Skeleton className="mb-2 h-8 w-56 rounded-lg" />
      <Skeleton className="mb-4 h-5 w-44" />
      <div className="mb-5 flex gap-3">
        <CardSkeleton className="h-[86px] flex-1" />
        <CardSkeleton className="h-[86px] w-28" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[72px]" />
        ))}
      </div>
      <CardSkeleton className="mt-8 h-20" />
    </div>
  );
}

import {
  PageHeaderSkeleton,
  Skeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading dashboard…</span>
      <PageHeaderSkeleton />
      <Skeleton className="mb-4 h-14 rounded-lg" />
      <CardSkeleton className="mb-6 h-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CardSkeleton className="h-64 lg:col-span-2" />
        <CardSkeleton className="h-72 lg:col-span-2" />
        <CardSkeleton className="h-80" />
        <CardSkeleton className="h-80" />
      </div>
    </div>
  );
}

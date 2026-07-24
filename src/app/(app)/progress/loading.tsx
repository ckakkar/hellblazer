import {
  PageHeaderSkeleton,
  Skeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading progress…</span>
      <PageHeaderSkeleton action={false} />
      <CardSkeleton className="mb-6 h-72" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <Skeleton className="h-10 rounded-lg sm:w-64" />
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} className="h-24" />
          ))}
        </div>
        <CardSkeleton className="h-72" />
        <CardSkeleton className="h-72" />
        <CardSkeleton className="h-80" />
      </div>
    </div>
  );
}

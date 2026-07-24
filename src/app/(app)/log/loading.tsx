import {
  PageHeaderSkeleton,
  Skeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <span className="sr-only">Loading…</span>
      <PageHeaderSkeleton action={false} />
      <CardSkeleton className="mb-6 h-40" />
      <Skeleton className="mb-4 h-20 rounded-lg" />
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

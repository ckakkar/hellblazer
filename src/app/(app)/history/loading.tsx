import {
  PageHeaderSkeleton,
  Skeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading history…</span>
      <PageHeaderSkeleton action={false} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 rounded-lg sm:w-56" />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[76px]" />
        ))}
      </div>
    </div>
  );
}

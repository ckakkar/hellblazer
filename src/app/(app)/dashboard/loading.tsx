import {
  ChartSkeleton,
  ListSkeleton,
  PageSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your dashboard" action>
      {/* rank strip */}
      <Skeleton className="mb-4 h-[52px] rounded-lg" />
      {/* active program card */}
      <Skeleton className="mb-6 h-[236px] rounded-xl" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <div className="mt-6">
        <Skeleton className="mb-3 h-3 w-32" />
        <ListSkeleton rows={4} />
      </div>
    </PageSkeleton>
  );
}

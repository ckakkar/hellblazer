import { ChartSkeleton, PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your progress">
      <div className="mb-4 flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton className="mb-4 h-10 w-full rounded-lg sm:w-80" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <Skeleton className="mt-4 h-[220px] rounded-xl" />
    </PageSkeleton>
  );
}

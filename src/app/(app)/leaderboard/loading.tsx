import { ListSkeleton, PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading the standings">
      {/* your-standing pill */}
      <Skeleton className="mb-4 h-8 w-56 rounded-full" />
      {/* champion */}
      <Skeleton className="mb-3 h-[124px] rounded-xl sm:h-[132px]" />
      {/* runners-up */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-[74px] rounded-xl" />
        <Skeleton className="h-[74px] rounded-xl" />
      </div>
      <ListSkeleton rows={6} />
    </PageSkeleton>
  );
}

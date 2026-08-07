import { ListSkeleton, PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your history">
      <Skeleton className="mb-4 h-10 w-full rounded-lg sm:w-72" />
      <ListSkeleton rows={7} height="h-[86px]" />
    </PageSkeleton>
  );
}

import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your settings" narrow>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[132px] rounded-xl" />
        <Skeleton className="h-[188px] rounded-xl" />
        <Skeleton className="h-[156px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
      </div>
    </PageSkeleton>
  );
}

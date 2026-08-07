import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your programs" action>
      <Skeleton className="mb-6 h-[236px] rounded-xl" />
      <Skeleton className="mb-3 h-3 w-32" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[124px] rounded-xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}

import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading this program" action>
      <Skeleton className="mb-4 h-[196px] rounded-xl" />
      <Skeleton className="h-[320px] rounded-xl" />
    </PageSkeleton>
  );
}

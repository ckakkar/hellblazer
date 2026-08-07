import { ListSkeleton, PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton label="Loading your templates" action>
      <ListSkeleton rows={5} height="h-[92px]" />
    </PageSkeleton>
  );
}

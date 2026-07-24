import {
  PageHeaderSkeleton,
  Skeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading leaderboard…</span>
      <PageHeaderSkeleton action={false} />
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[76px]" />
        ))}
      </div>
    </div>
  );
}

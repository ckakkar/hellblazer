import {
  PageHeaderSkeleton,
  CardSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <span className="sr-only">Loading programs…</span>
      <PageHeaderSkeleton />
      <CardSkeleton className="mb-6 h-44" />
      <CardSkeleton className="mb-6 h-56" />
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} className="h-[72px]" />
        ))}
      </div>
    </div>
  );
}

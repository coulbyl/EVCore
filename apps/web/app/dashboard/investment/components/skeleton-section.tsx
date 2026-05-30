import { Skeleton } from "@evcore/ui";

export function SkeletonSection() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-28 rounded-[1.4rem]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-[1.35rem]" />
        ))}
      </div>
    </div>
  );
}

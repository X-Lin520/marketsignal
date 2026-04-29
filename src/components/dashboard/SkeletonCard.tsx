import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard() {
  return (
    <Card className="border-l-4 border-l-neutral-sentiment bg-terminal-surface/40 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="mt-2 h-5 w-full" />
      <Skeleton className="mt-1 h-5 w-3/4" />
      <Skeleton className="mt-1 h-4 w-full" />
      <div className="mt-2 flex gap-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
    </Card>
  );
}

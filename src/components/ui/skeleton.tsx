/** Placeholder block. Sized by the caller so nothing shifts on arrival. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-raised ${className}`} />;
}

/** The directory row skeleton, matching the real row's dimensions exactly. */
export function PersonRowSkeleton() {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="size-12 shrink-0 rounded-full" />
    </div>
  );
}

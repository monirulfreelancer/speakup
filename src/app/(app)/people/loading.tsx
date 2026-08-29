import { PersonRowSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function PeopleLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-12 rounded-full" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <PersonRowSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}

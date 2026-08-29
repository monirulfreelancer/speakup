export default function PeopleLoading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse space-y-4 p-4 md:p-8">
      <div className="h-8 w-32 rounded bg-accent" />
      <div className="h-11 w-full rounded-lg bg-accent" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-14 rounded-full bg-accent" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
            <div className="size-12 shrink-0 rounded-full bg-accent" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-accent" />
              <div className="h-3 w-48 rounded bg-accent" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

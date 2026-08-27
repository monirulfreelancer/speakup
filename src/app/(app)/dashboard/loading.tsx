export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-accent" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-accent" />
          <div className="h-3 w-28 rounded bg-accent" />
        </div>
        <div className="h-7 w-10 rounded-full bg-accent" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-h-32 rounded-2xl bg-accent" />
        <div className="min-h-32 rounded-2xl bg-accent" />
      </div>
      <div className="h-20 rounded-xl bg-accent" />
      <div className="h-32 rounded-xl bg-accent" />
    </main>
  );
}

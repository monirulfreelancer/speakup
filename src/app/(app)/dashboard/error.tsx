"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        We couldn’t load your dashboard. It’s probably temporary — try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}

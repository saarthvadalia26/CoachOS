import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

export function DashboardLoading() {
  return (
    <main
      aria-label="Loading dashboard"
      className="min-h-full bg-background text-foreground"
    >
      <div className="flex min-h-full flex-col md:flex-row">
        <aside className="border-b border-border bg-card px-4 py-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:px-5">
          <SkeletonBlock className="h-6 w-28" />
          <SkeletonBlock className="mt-3 h-4 w-36" />
          <div className="mt-6 flex gap-2 overflow-hidden md:grid">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-9 w-28 md:w-full" />
            ))}
          </div>
        </aside>

        <section className="flex-1 px-6 py-8 md:px-8 lg:px-10">
          <div className="mx-auto grid w-full max-w-6xl gap-8">
            <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-3">
                <SkeletonBlock className="h-4 w-44" />
                <SkeletonBlock className="h-9 w-64" />
                <SkeletonBlock className="h-4 w-56" />
              </div>
              <SkeletonBlock className="h-8 w-24" />
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="mt-4 h-8 w-20" />
                  <SkeletonBlock className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="mt-5 h-10 w-full" />
                <SkeletonBlock className="mt-3 h-10 w-full" />
                <SkeletonBlock className="mt-5 h-8 w-28" />
              </div>
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <SkeletonBlock className="h-5 w-40" />
                <div className="mt-5 grid gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-14 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

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
      <div className="flex min-h-full flex-col xl:flex-row">
        <aside className="border-b border-sidebar-border bg-sidebar px-4 py-4 text-sidebar-foreground xl:min-h-screen xl:w-64 xl:border-b-0 xl:border-r xl:px-5">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="size-8 rounded-lg" />
              <SkeletonBlock className="h-6 w-28" />
            </div>
            <SkeletonBlock className="mt-3 h-4 w-36" />
          </div>
          <div className="flex gap-2 overflow-hidden xl:grid">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-9 w-28 xl:w-full" />
            ))}
          </div>
        </aside>

        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid gap-3">
                <SkeletonBlock className="h-4 w-44" />
                <SkeletonBlock className="h-9 w-48 sm:w-64" />
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

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="mt-3 h-4 w-full max-w-lg" />
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-9 w-full sm:w-36" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

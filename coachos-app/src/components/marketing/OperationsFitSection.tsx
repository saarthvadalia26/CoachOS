const workflowPoints = [
  "Multi-branch operating structure",
  "Role-aware access for daily teams",
  "Attendance and fee follow-up workflows",
  "Clean operational records for owners",
];

export function OperationsFitSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="min-w-0 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Built for institute operations
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Designed for multi-branch coaching workflows.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              CoachOS keeps branch, student, batch, attendance, fee, and staff
              workflows aligned in one practical operating dashboard.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {workflowPoints.map((point) => (
              <div
                key={point}
                className="min-w-0 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

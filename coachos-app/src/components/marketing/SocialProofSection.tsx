const proofPoints = [
  "Multi-branch operating model",
  "Role-aware access for teams",
  "Attendance and fee workflows",
  "Clean records for institute owners",
];

export function SocialProofSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="grid gap-8 md:grid-cols-[0.85fr_1.15fr] md:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Built for growing coaching institutes
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Professional operations without enterprise complexity.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground"
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

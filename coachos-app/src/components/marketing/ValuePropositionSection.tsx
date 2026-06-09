const valuePoints = [
  "Branch-aware workflows",
  "Role-based staff access",
  "Professional records",
];

export function ValuePropositionSection() {
  return (
    <section id="value" className="border-y border-border bg-muted/35">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-16 md:grid-cols-[0.8fr_1.2fr] md:items-start">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            Built for growing coaching institutes
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Less admin work. More time for teaching and growth.
          </h2>
        </div>
        <div className="grid gap-5">
          <p className="text-lg leading-8 text-muted-foreground">
            Coaching teams need fast visibility into students, batches,
            attendance, branches, payments, and staff responsibility. CoachOS
            brings daily operations into one simple dashboard so owners,
            managers, and staff can act with the same information.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {valuePoints.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

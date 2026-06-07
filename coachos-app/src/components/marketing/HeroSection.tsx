import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-28">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Built for coaching institutes
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Run your coaching institute from one clear operating system.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          CoachOS helps coaching institutes manage branches, students, batches,
          attendance, and fee records without scattered registers or spreadsheets.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href="#contact">Book a demo</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#features">View features</a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4">
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Today&apos;s focus</p>
            <p className="mt-2 text-2xl font-semibold">
              18 pending fee records
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Active batches</p>
              <p className="mt-2 text-2xl font-semibold">24</p>
            </div>
            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Attendance today</p>
              <p className="mt-2 text-2xl font-semibold">16</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Next batch</p>
            <p className="mt-2 font-medium">
              Class 12 Physics starts at 5:30 PM
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

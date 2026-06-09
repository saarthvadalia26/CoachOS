import {
  ArrowRight,
  CalendarCheck,
  IndianRupee,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const previewStats = [
  { label: "Students", value: "1,248" },
  { label: "Active batches", value: "64" },
  { label: "Branches", value: "8" },
];

const scheduleItems = [
  {
    label: "Class 12 Physics - Central Branch",
    time: "5:30 PM",
  },
  {
    label: "Grade 10 Mathematics - North Branch",
    time: "6:15 PM",
  },
  {
    label: "JEE Foundation - East Branch",
    time: "7:00 PM",
  },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,oklch(0.76_0.16_67_/_0.24),transparent_30%),linear-gradient(135deg,oklch(0.98_0.018_274),oklch(0.99_0.006_270)_45%,oklch(0.94_0.035_276))]" />
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-16 pt-20 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-primary">
            Built for growing coaching institutes
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Run every branch, batch, fee cycle, and attendance record from one
            secure dashboard.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            CoachOS gives owners and teams a professional operating system for
            students, staff roles, attendance, and fee follow-ups without
            scattered registers or spreadsheets.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="accent">
              <a href="#contact">
                Book a demo
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#features">View features</a>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/90 p-3 shadow-2xl shadow-primary/15 backdrop-blur">
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Institute Overview</p>
                <p className="text-xs text-muted-foreground">
                  Multi-branch operations dashboard
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Live data</span>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[0.68fr_0.32fr]">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {previewStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Today&apos;s schedule</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Attendance, batches, and branch activity
                      </p>
                    </div>
                    <CalendarCheck aria-hidden="true" className="size-5 text-primary" />
                  </div>
                  <div className="mt-4 grid gap-3">
                    {scheduleItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee aria-hidden="true" className="size-4 text-primary" />
                    <p className="text-sm font-medium">Fee follow-ups</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold">42</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pending records prioritized by due date.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <UsersRound aria-hidden="true" className="size-4 text-primary" />
                    <p className="text-sm font-medium">Team permissions</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Owners, branch managers, accountants, operations staff, and
                    teachers see only what their role allows.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                    <p className="text-sm font-medium">Secure access</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Branch-aware permissions keep institute data protected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

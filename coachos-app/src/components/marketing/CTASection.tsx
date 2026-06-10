import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section id="contact" className="px-6 py-20">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-primary text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] opacity-80">
              Demo-ready operations
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Ready to organize your institute on CoachOS?
            </h2>
            <p className="mt-3 max-w-2xl text-primary-foreground/75">
              Start with a focused walkthrough of how CoachOS can fit your
              branches, batches, fee cycles, attendance workflow, and staff
              roles.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact">Book a demo</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <a href="#features">Review features</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

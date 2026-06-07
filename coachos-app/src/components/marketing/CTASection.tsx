import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section id="contact" className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready to organize your institute?
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start with a focused walkthrough of how CoachOS can fit your
            branches, batches, fee cycles, and attendance workflow.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href="mailto:hello@coachos.app">Book a demo</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#features">View features</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

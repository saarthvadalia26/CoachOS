import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    description: "For institutes organizing their first digital operations.",
    features: ["One institute dashboard", "Core student and batch records", "Attendance and fee tracking"],
  },
  {
    name: "Growth",
    description: "For growing teams managing multiple branches and roles.",
    features: ["Branch management", "Staff roles and permissions", "Reports and CSV exports"],
  },
  {
    name: "Institute",
    description: "For established coaching brands that need guided rollout.",
    features: ["Multi-branch rollout support", "Operational workflow setup", "Priority onboarding"],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-y border-border bg-muted/35">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Choose a rollout path that fits your institute.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Exact pricing depends on branch count, team size, and onboarding
            requirements.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
            >
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {plan.description}
              </p>
              <p className="mt-6 text-2xl font-semibold">
                Contact for pricing
              </p>
              <ul className="mt-6 grid gap-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant="outline">
                <Link href="/contact">Discuss {plan.name}</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    label: "Launch offer: ₹999/month for first 3 months",
    price: "₹1,499/month",
    description: "For single-branch institutes starting with digital operations.",
    features: [
      "1 branch",
      "Up to 100 active students",
      "Up to 5 staff users",
      "Students, batches, attendance, and fees",
      "Homework and tests",
      "Student and parent portal",
      "Basic reports",
    ],
  },
  {
    name: "Growth",
    label: "Launch offer: ₹2,999/month for first 3 months",
    price: "₹3,999/month",
    description: "Best for growing institutes managing multiple branches and roles.",
    features: [
      "Up to 3 branches",
      "Up to 500 active students",
      "Up to 20 staff users",
      "Everything in Starter",
      "Communication hub",
      "Advanced homework and test tracking",
      "Role-based permissions",
      "CSV exports",
      "Priority support",
    ],
    isPopular: true,
  },
  {
    name: "Institute",
    label: "Custom plan",
    price: "Starting from ₹9,999/month",
    description: "For established coaching brands that need custom rollout support.",
    features: [
      "Custom branches",
      "Custom student and staff limits",
      "Dedicated onboarding",
      "Data import support",
      "Custom reports",
      "Priority support",
    ],
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
            Transparent packages for coaching institutes, with launch pricing
            for early customers.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "relative rounded-lg border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                plan.isPopular
                  ? "border-primary/50 shadow-primary/10 hover:shadow-primary/15"
                  : "border-border hover:border-primary/30 hover:shadow-primary/10",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {plan.label}
                  </p>
                </div>
                {plan.isPopular ? (
                  <Badge className="bg-accent text-accent-foreground">
                    Most popular
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {plan.description}
              </p>
              <p className="mt-6 text-3xl font-semibold tracking-tight">
                {plan.price}
              </p>
              <p className="mt-2 min-h-10 text-sm font-medium text-primary">
                {plan.label}
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
              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.isPopular ? "accent" : "outline"}
              >
                <Link href="/contact">Discuss {plan.name}</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

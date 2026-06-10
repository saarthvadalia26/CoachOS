import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "@/components/marketing/ContactForm";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Request a CoachOS walkthrough for your coaching institute and discuss branches, batches, attendance, fees, and staff workflows.",
};

export default function ContactPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
        <section>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            Contact CoachOS
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Discuss a practical rollout for your institute.
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Share your institute size, branch structure, and operational needs.
            We&apos;ll help you evaluate whether CoachOS fits your current
            student, batch, attendance, fee, and staff workflows.
          </p>
          <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            <p>
              Best for owners and administrators who want a secure operating
              dashboard before expanding into deeper automation.
            </p>
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                Log in to CoachOS
              </Link>
            </p>
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/">Back to homepage</Link>
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <ContactForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}

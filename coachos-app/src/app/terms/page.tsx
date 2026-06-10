import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "CoachOS terms of service for coaching institutes evaluating the platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          Terms of Service
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Terms for using CoachOS.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: Jun 9, 2026
        </p>

        <div className="mt-10 grid gap-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Use of the service
            </h2>
            <p className="mt-2">
              CoachOS is provided for coaching institutes to manage internal
              operations such as branches, students, batches, attendance, fees,
              and staff permissions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Institute responsibility
            </h2>
            <p className="mt-2">
              Institutes are responsible for the accuracy of data entered into
              CoachOS, for assigning appropriate staff roles, and for using
              exported records responsibly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Account access
            </h2>
            <p className="mt-2">
              Users must keep their login credentials secure and may only access
              institute data they are authorized to view or manage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Availability
            </h2>
            <p className="mt-2">
              CoachOS is an early-stage SaaS product. We aim to provide a
              reliable service, but do not guarantee uninterrupted availability
              during evaluation or rollout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Contact
            </h2>
            <p className="mt-2">
              Questions about these terms can be submitted through the{" "}
              <Link href="/contact" className="font-medium text-foreground underline">
                contact form
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

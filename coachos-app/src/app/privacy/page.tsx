import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "CoachOS privacy policy for coaching institutes evaluating the platform.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          Privacy Policy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          How CoachOS handles institute data.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: Jun 9, 2026
        </p>

        <div className="mt-10 grid gap-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Information we collect
            </h2>
            <p className="mt-2">
              CoachOS stores the information an institute enters into the
              product, such as branch names, student records, batch details,
              attendance records, fee records, and staff account details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              How information is used
            </h2>
            <p className="mt-2">
              We use institute data to provide the dashboard, role-based access,
              operational workflows, and internal reporting features requested by
              the institute.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Access and security
            </h2>
            <p className="mt-2">
              CoachOS uses authenticated access and role-aware permissions so
              users can only access records allowed by their institute role and
              branch assignment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Data sharing
            </h2>
            <p className="mt-2">
              CoachOS does not sell institute or student data. Data is shared
              only when needed to operate the service, comply with law, or
              support the institute&apos;s authorized use of the product.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Contact
            </h2>
            <p className="mt-2">
              Questions about privacy can be submitted through the{" "}
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

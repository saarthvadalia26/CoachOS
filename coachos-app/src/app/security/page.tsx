import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";

export const metadata: Metadata = {
  title: "Security",
  description:
    "CoachOS security overview for branch-aware permissions and institute data access.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          Security
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Security foundations for institute operations.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: Jun 9, 2026
        </p>

        <div className="mt-10 grid gap-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Authenticated access
            </h2>
            <p className="mt-2">
              CoachOS requires authenticated accounts for dashboard access and
              keeps public marketing pages separate from institute operations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Role-aware permissions
            </h2>
            <p className="mt-2">
              Owners, branch managers, accountants, operations staff, academic
              coordinators, and teachers receive different access based on their
              operational responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Branch-aware access
            </h2>
            <p className="mt-2">
              Branch-scoped users can only work with the branches and batches
              their role allows. Owners keep organization-wide visibility.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Responsible rollout
            </h2>
            <p className="mt-2">
              Institutes should review role assignments regularly and remove
              access promptly when staff responsibilities change.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Contact
            </h2>
            <p className="mt-2">
              Security questions can be submitted through the{" "}
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

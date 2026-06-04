import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/auth/permissions";

export default async function AccessDeniedPage() {
  const { profile, role } = await getCurrentUserContext();
  const hasInstitute = Boolean(profile?.institute_id);

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">CoachOS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your account does not have permission to open this dashboard section.
          Ask the institute owner to check your team role.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {hasInstitute && role ? (
            <Button asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/onboarding">Continue setup</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/login">Use another account</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getCurrentUserContext,
  getStaffLinkStatusMessage,
  resolvePostAuthRedirect,
} from "@/lib/auth/permissions";
import { createInstituteAndProfile } from "@/lib/onboarding/actions";

export const metadata: Metadata = {
  title: "Institute Setup",
};

export default async function OnboardingPage() {
  const context = await getCurrentUserContext();
  const { staffLinkStatus } = context;
  const staffLinkMessage = getStaffLinkStatusMessage(staffLinkStatus);
  const postAuthRedirect = await resolvePostAuthRedirect(
    context.supabase,
    "/dashboard",
  );

  // Staff and portal accounts are linked to existing institute records.
  // They should not create a new institute through owner onboarding.
  if (postAuthRedirect !== "/onboarding") {
    redirect(postAuthRedirect);
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">CoachOS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Set up your institute
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Add the basic details for your coaching institute before entering
            the dashboard.
          </p>
        </div>

        {staffLinkMessage ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {staffLinkMessage}
          </p>
        ) : null}

        {staffLinkMessage ? null : (
          <form action={createInstituteAndProfile} className="mt-6 grid gap-4">
            <Label>
              Your full name
              <Input
                required
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Aarav Sharma"
              />
            </Label>
            <Label>
              Institute name
              <Input
                required
                name="instituteName"
                type="text"
                autoComplete="organization"
                placeholder="Bright Future Classes"
              />
            </Label>
            <SubmitButton className="mt-2" pendingLabel="Creating...">
              Create institute
            </SubmitButton>
          </form>
        )}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCurrentUserContext,
  getStaffLinkStatusMessage,
} from "@/lib/auth/permissions";
import { createInstituteAndProfile } from "@/lib/onboarding/actions";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const { profile, staffLinkStatus } = await getCurrentUserContext();
  const params = await searchParams;
  const staffLinkMessage = getStaffLinkStatusMessage(staffLinkStatus);

  // If this account matches a staff_members record, getCurrentUserContext()
  // has already created the staff profile. Staff users should enter the
  // dashboard for their existing institute, not create a new institute here.
  if (profile?.institute_id) {
    redirect("/dashboard");
  }

  const blockingMessage = staffLinkMessage || params.error;

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

        {blockingMessage ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {blockingMessage}
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
            <Button type="submit" className="mt-2">
              Create institute
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

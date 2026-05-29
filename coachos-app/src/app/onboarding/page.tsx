import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createInstituteAndProfile } from "@/lib/onboarding/actions";
import { createClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("institute_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.institute_id) {
    redirect("/dashboard");
  }

  const params = await searchParams;

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

        {params.error ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <form action={createInstituteAndProfile} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Your full name
            <input
              required
              name="fullName"
              type="text"
              autoComplete="name"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Aarav Sharma"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Institute name
            <input
              required
              name="instituteName"
              type="text"
              autoComplete="organization"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Bright Future Classes"
            />
          </label>
          <Button type="submit" className="mt-2">
            Create institute
          </Button>
        </form>
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { signup } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create Account",
};

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">CoachOS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Create your institute account
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Create the owner account for your coaching institute and complete setup in the dashboard.
          </p>
        </div>

        {params.error ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <form action={signup} className="mt-6 grid gap-4">
          <Label>
            Email
            <Input
              required
              name="email"
              type="email"
              autoComplete="email"
              placeholder="owner@institute.com"
            />
          </Label>
          <Label>
            Password
            <Input
              required
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
            />
          </Label>
          <SubmitButton className="mt-2" pendingLabel="Creating...">
            Sign up
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}

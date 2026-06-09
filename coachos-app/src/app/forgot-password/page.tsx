import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset Password",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
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
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter your account email and we will send secure instructions to
            help you set a new password.
          </p>
        </div>

        {params.error ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        {params.message ? (
          <p className="mt-5 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {params.message}
          </p>
        ) : null}

        <form action={requestPasswordReset} className="mt-6 grid gap-4">
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
          <SubmitButton className="mt-2" pendingLabel="Sending...">
            Send reset instructions
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}

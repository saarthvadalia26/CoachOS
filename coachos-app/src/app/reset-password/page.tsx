import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { PasswordField } from "@/components/auth/PasswordField";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePassword } from "@/lib/auth/actions";
import { passwordRecoveryCookieName } from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set New Password",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const { data } = await supabase.auth.getClaims();
  const hasRecoveryMarker =
    cookieStore.get(passwordRecoveryCookieName)?.value === "1";
  const hasResetSession = Boolean(data?.claims && hasRecoveryMarker);

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            CoachOS
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Choose a secure password for your CoachOS account.
          </p>
        </div>

        {hasResetSession ? (
          <form action={updatePassword} className="mt-6 grid gap-4">
            <PasswordField
              required
              minLength={8}
              label="New password"
              name="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              hint="Use at least 8 characters."
            />
            <PasswordField
              required
              minLength={8}
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your new password"
            />
            <SubmitButton className="mt-2" pendingLabel="Updating...">
              Update password
            </SubmitButton>
          </form>
        ) : (
          <div className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>
              This password reset link is invalid or has expired. Request a new
              reset email to continue.
            </p>
            <Link
              href="/forgot-password"
              className="mt-3 inline-flex font-medium text-foreground underline"
            >
              Request a new reset email
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Back to{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-foreground underline">
            Back to homepage
          </Link>
        </p>
      </section>
    </main>
  );
}

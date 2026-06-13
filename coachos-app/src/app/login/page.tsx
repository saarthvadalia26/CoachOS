import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordField } from "@/components/auth/PasswordField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { login } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Log in",
};

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            CoachOS
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Log in to your institute
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Access your students, batches, attendance, and fees from one secure dashboard.
          </p>
        </div>

        <form action={login} className="mt-6 grid gap-4">
          <input type="hidden" name="next" value={nextPath} />
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
          <PasswordField
            required
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
          />
          <div className="-mt-2 text-right text-sm">
            <Link href="/forgot-password" className="font-medium text-foreground underline">
              Forgot password?
            </Link>
          </div>
          <SubmitButton className="mt-2" pendingLabel="Signing in...">
            Log in
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to CoachOS?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-foreground underline"
          >
            Create an account
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

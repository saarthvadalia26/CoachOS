import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordField } from "@/components/auth/PasswordField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { signup } from "@/lib/auth/actions";
import { resolvePostAuthRedirect } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create Account",
};

type SignupPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/dashboard";
  const isPortalSignup = nextPath.startsWith("/portal/");

  if (claims) {
    redirect(await resolvePostAuthRedirect(supabase, nextPath));
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            CoachOS
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {isPortalSignup
              ? "Create your portal account"
              : "Create your institute account"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {isPortalSignup
              ? "Use the email your institute has linked for portal access."
              : "Create the owner account for your coaching institute and complete setup in the dashboard."}
          </p>
        </div>

        <form action={signup} className="mt-6 grid gap-4">
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
            minLength={8}
            label="Password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            hint="Use at least 8 characters."
          />
          <SubmitButton className="mt-2" pendingLabel="Creating...">
            Sign up
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-foreground underline"
          >
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

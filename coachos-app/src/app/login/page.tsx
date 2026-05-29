import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
            Log in to your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use your institute account to access the CoachOS dashboard.
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

        <form action={login} className="mt-6 grid gap-4">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="owner@institute.com"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Enter your password"
            />
          </label>
          <Button type="submit" className="mt-2">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to CoachOS?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}

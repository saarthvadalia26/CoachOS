import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { logout } from "@/lib/auth/actions";

type PortalShellProps = {
  children: ReactNode;
  description: string;
  email?: string;
  title: string;
};

export function PortalShell({
  children,
  description,
  email,
  title,
}: PortalShellProps) {
  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-primary"
            >
              CoachOS
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {email ? (
              <p className="break-all text-xs text-muted-foreground">
                Signed in as {email}
              </p>
            ) : null}
            <form action={logout}>
              <SubmitButton
                className="w-full sm:w-auto"
                pendingLabel="Signing out..."
                size="sm"
                variant="outline"
              >
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}

export function PortalAccessLinks({
  kind,
}: {
  kind: "parent" | "student";
}) {
  const currentPath = `/portal/${kind}`;

  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
      <Button asChild>
        <Link href={`/login?next=${encodeURIComponent(currentPath)}`}>
          Log in
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/signup?next=${encodeURIComponent(currentPath)}`}>
          Create portal account
        </Link>
      </Button>
    </div>
  );
}

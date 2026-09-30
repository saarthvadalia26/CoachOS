import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageContainer } from "@/components/ui/responsive-layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-muted/30 text-foreground">
      <header className="border-b border-border bg-background/95">
        <PageContainer className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-primary"
            >
              CoachOS
            </Link>
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            <div className="flex items-center gap-3">
              {email ? (
                <p className="break-all text-xs text-muted-foreground">
                  Signed in as {email}
                </p>
              ) : null}
              <ThemeToggle />
            </div>
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
        </PageContainer>
      </header>
      <PageContainer className="py-6">{children}</PageContainer>
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
    <div className="mt-6 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
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

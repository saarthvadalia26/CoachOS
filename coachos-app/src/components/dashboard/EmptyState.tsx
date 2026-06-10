import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({
  actionHref,
  actionLabel,
  children,
  description,
  title,
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
      <div className="max-w-xl">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {actionHref && actionLabel ? (
        <Button asChild variant="outline" className="mt-4 w-full sm:w-auto">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

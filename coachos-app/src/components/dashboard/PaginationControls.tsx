import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getTotalPages } from "@/lib/dashboard/list-controls";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  pageSize?: number;
  params: Record<string, string | null | undefined>;
  totalCount: number;
};

function getPageHref({
  basePath,
  page,
  params,
}: {
  basePath: string;
  page: number;
  params: Record<string, string | null | undefined>;
}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") {
      searchParams.set(key, value);
    }
  }

  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const queryString = searchParams.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function PaginationControls({
  basePath,
  page,
  pageSize,
  params,
  totalCount,
}: PaginationControlsProps) {
  const totalPages = getTotalPages(totalCount, pageSize);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Page {Math.min(page, totalPages)} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button asChild={page > 1} disabled={page <= 1} variant="outline">
          {page > 1 ? (
            <Link href={getPageHref({ basePath, page: page - 1, params })}>
              Previous
            </Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        <Button
          asChild={page < totalPages}
          disabled={page >= totalPages}
          variant="outline"
        >
          {page < totalPages ? (
            <Link href={getPageHref({ basePath, page: page + 1, params })}>
              Next
            </Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </div>
    </nav>
  );
}

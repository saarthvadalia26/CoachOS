import { Building2, Plus, Save, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasAnyPermission, requirePermission } from "@/lib/auth/permissions";
import { createBranch, updateBranch } from "@/lib/branches/actions";
import {
  defaultPageSize,
  getPage,
  getPageSummary,
  getPaginationRange,
  getSearchTerm,
} from "@/lib/dashboard/list-controls";

type BranchesPageProps = {
  searchParams: Promise<{
    error?: string;
    page?: string;
    q?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Branches",
};

export default async function BranchesPage({
  searchParams,
}: BranchesPageProps) {
  const { accessibleBranches, claims, institute, profile, role } =
    await requirePermission("branches.view");
  const params = await searchParams;
  const searchTerm = getSearchTerm(params.q);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const canManageBranches = hasAnyPermission(role, [
    "branches.create",
    "branches.update",
  ]);
  const filteredBranches = searchTerm
    ? accessibleBranches.filter((branch) => {
        const haystack = `${branch.name} ${branch.address ?? ""}`.toLowerCase();

        return haystack.includes(searchTerm.toLowerCase());
      })
    : accessibleBranches;
  const paginatedBranches = filteredBranches.slice(
    paginationRange.from,
    paginationRange.to + 1,
  );
  const filterParams = {
    q: searchTerm,
  };

  return (
    <DashboardShell
      activePage="branches"
      instituteName={institute.name}
      role={role}
      title="Branches"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section
        className={
          canManageBranches
            ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
            : "grid gap-6"
        }
      >
        {canManageBranches ? (
          <Card id="create-branch">
            <CardHeader>
              <CardTitle className="text-xl">Create branch</CardTitle>
              <CardDescription>
                Add an operational center under this institute.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createBranch} className="grid gap-4">
                <Label>
                  Branch name
                  <Input
                    required
                    name="name"
                    type="text"
                    autoComplete="organization"
                    placeholder="Main Branch"
                  />
                </Label>
                <Label>
                  Address
                  <Input
                    name="address"
                    type="text"
                    autoComplete="street-address"
                    placeholder="Optional branch address"
                  />
                </Label>
                <SubmitButton className="mt-1" pendingLabel="Creating...">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Create branch
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Find branches</CardTitle>
              <CardDescription>
                Search by branch name or address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                <Label className="min-w-0">
                  Search
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Branch name or address"
                  />
                </Label>
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                  variant="outline"
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/dashboard/branches">Reset filters</Link>
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Branch list
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canManageBranches
                  ? `${getPageSummary({
                      page,
                      shownCount: paginatedBranches.length,
                      totalCount: filteredBranches.length,
                    })} in ${institute.name}`
                  : "Your assigned branch"}
              </p>
            </div>
            <Badge variant="outline">
              {canManageBranches ? "Owner managed" : "Assigned branch"}
            </Badge>
          </div>

          {paginatedBranches.length ? (
            <div className="grid gap-4">
              {paginatedBranches.map((branch) => (
                <Card key={branch.id}>
                  <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-start gap-2 text-lg leading-tight">
                        <Building2
                          aria-hidden="true"
                          className="mt-1 size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="break-words">{branch.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {branch.address ?? "Address not added"}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                      <Badge variant="secondary">
                        {canManageBranches ? "Institute branch" : "Assigned"}
                      </Badge>
                    </div>
                  </CardHeader>

                  {canManageBranches ? (
                    <CardContent>
                      <details className="rounded-md border border-border bg-muted/30 p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Edit branch
                        </summary>
                        <form
                          action={updateBranch}
                          className="mt-4 grid gap-3 sm:grid-cols-2"
                        >
                          <input
                            name="branchId"
                            type="hidden"
                            value={branch.id}
                          />
                          <Label>
                            Branch name
                            <Input
                              required
                              name="name"
                              type="text"
                              defaultValue={branch.name}
                              autoComplete="organization"
                            />
                          </Label>
                          <Label>
                            Address
                            <Input
                              name="address"
                              type="text"
                              defaultValue={branch.address ?? ""}
                              autoComplete="street-address"
                            />
                          </Label>
                          <SubmitButton
                            className="sm:col-span-2 sm:w-fit"
                            pendingLabel="Updating..."
                          >
                            <Save aria-hidden="true" data-icon="inline-start" />
                            Save changes
                          </SubmitButton>
                        </form>
                      </details>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
              <PaginationControls
                basePath="/dashboard/branches"
                page={page}
                pageSize={defaultPageSize}
                params={filterParams}
                totalCount={filteredBranches.length}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  actionHref={
                    !searchTerm && canManageBranches
                      ? "/dashboard/branches#create-branch"
                      : undefined
                  }
                  actionLabel="Create branch"
                  title={
                    searchTerm
                      ? "No branches match these filters"
                      : canManageBranches
                        ? "No branches created yet"
                        : "No branch assigned"
                  }
                  description={
                    searchTerm
                      ? "Adjust your search to find branch records."
                      : canManageBranches
                        ? "Create a branch to organize students, batches, staff, and operations."
                        : "Ask the institute owner to assign a branch if you need access."
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

import { Building2, Plus, Save } from "lucide-react";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
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

type BranchesPageProps = {
  searchParams: Promise<{
    error?: string;
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
  const canManageBranches = hasAnyPermission(role, [
    "branches.create",
    "branches.update",
  ]);

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
            ? "grid gap-6 lg:grid-cols-[360px_1fr]"
            : "grid gap-6"
        }
      >
        {canManageBranches ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Create branch</CardTitle>
              <CardDescription>
                Add an operational center under this institute.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionMessage
                className="mb-4"
                error={params.error}
                success={params.success}
              />

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
        ) : params.error ? (
          <ActionMessage error={params.error} />
        ) : null}

        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Branch list
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canManageBranches
                  ? `${accessibleBranches.length} ${
                      accessibleBranches.length === 1 ? "branch" : "branches"
                    } in ${institute.name}`
                  : "Your assigned branch"}
              </p>
            </div>
            <Badge variant="outline">
              {canManageBranches ? "Owner managed" : "Assigned branch"}
            </Badge>
          </div>

          {accessibleBranches.length ? (
            <div className="grid gap-4">
              {accessibleBranches.map((branch) => (
                <Card key={branch.id}>
                  <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                        {branch.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {branch.address ?? "Address not added"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {canManageBranches ? "Institute branch" : "Assigned"}
                    </Badge>
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
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">
                  {canManageBranches
                    ? "No branches have been created yet. Create a branch to organize operations."
                    : "No branches are available for this account. Ask the institute owner to assign a branch if you need access."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

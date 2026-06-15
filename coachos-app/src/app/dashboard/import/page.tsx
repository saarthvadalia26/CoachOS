import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canAccessPermission,
  requireDashboardAccess,
} from "@/lib/auth/permissions";
import type { CsvImportKind } from "@/lib/import/types";

import { ImportCsvClient } from "./ImportCsvClient";

export const metadata: Metadata = {
  title: "Import data",
};

export default async function ImportPage() {
  const context = await requireDashboardAccess();
  const { accessibleBranches, claims, institute, profile, role } = context;
  const enabledImports: CsvImportKind[] = [];
  const canImportStudents = canAccessPermission(context, "students.create");
  const canImportBatches = canAccessPermission(context, "batches.create");
  const canImportAssignments = canAccessPermission(context, "batches.update");

  if (canImportStudents) {
    enabledImports.push("students");
  }

  if (canImportBatches) {
    enabledImports.push("batches");
  }

  if (canImportAssignments) {
    enabledImports.push("assignments");
  }

  if (!enabledImports.length) {
    redirect("/dashboard/access-denied");
  }

  const branchNameRequired = context.branchScope === "all";

  return (
    <DashboardShell
      activePage="import"
      instituteName={institute.name}
      role={role}
      title="Import data"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">CSV onboarding imports</CardTitle>
                <CardDescription className="mt-2">
                  Bring existing students, batches, and student-batch assignments
                  into CoachOS with branch-safe validation before records are
                  created.
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                <Badge variant="secondary">
                  {branchNameRequired ? "Branch column required" : "Assigned branch only"}
                </Badge>
                <Badge variant="outline">CSV only</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {accessibleBranches.length ? (
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>
                  Download a template, upload your completed CSV, review the
                  preview, then confirm the import. Critical validation errors
                  block the import. Duplicate records are skipped and reported in
                  the import summary.
                </p>
                <p>
                  Owner imports must include <span className="font-medium text-foreground">branch_name</span>.
                  Branch-scoped users can import only into their assigned branch.
                </p>
              </div>
            ) : (
              <EmptyState
                actionHref="/dashboard/branches"
                actionLabel="Create branch"
                title="Create a branch before importing data"
                description="Students, batches, and assignments must belong to a branch. Create your first branch, then return to imports."
              />
            )}
          </CardContent>
        </Card>

        {accessibleBranches.length ? (
          <ImportCsvClient
            branchNameRequired={branchNameRequired}
            enabledImports={enabledImports}
          />
        ) : null}
      </section>
    </DashboardShell>
  );
}

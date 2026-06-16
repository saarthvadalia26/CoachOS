import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Search } from "lucide-react";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
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
import {
  activityEntityTypes,
  getActivityActionLabel,
  getActivityEntityLabel,
  getActivityPageData,
} from "@/lib/activity/data";
import { getPageSummary } from "@/lib/dashboard/list-controls";
import { formatDateTime } from "@/lib/formatters/date";

type ActivityPageProps = {
  searchParams: Promise<{
    actor?: string;
    branchId?: string;
    entityType?: string;
    fromDate?: string;
    page?: string;
    q?: string;
    toDate?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Activity Log",
};

function getPaginationParams(filters: {
  actor: string;
  branchId: string;
  entityType: string;
  fromDate: string;
  q: string;
  toDate: string;
}) {
  return {
    actor: filters.actor || undefined,
    branchId: filters.branchId !== "all" ? filters.branchId : undefined,
    entityType:
      filters.entityType !== "all" ? filters.entityType : undefined,
    fromDate: filters.fromDate || undefined,
    q: filters.q || undefined,
    toDate: filters.toDate || undefined,
  };
}

const controlClass =
  "h-11 w-full min-w-0 box-border rounded-xl border border-input bg-background px-4 text-sm";

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const data = await getActivityPageData(await searchParams);
  const {
    branches,
    context,
    error,
    filters,
    logs,
    page,
    totalCount,
  } = data;
  const showBranchFilter = context.role === "owner" && branches.length > 1;
  const paginationParams = getPaginationParams(filters);

  return (
    <DashboardShell
      activePage="activity"
      instituteName={context.institute.name}
      role={context.role}
      title="Activity Log"
      userEmail={context.claims.email}
      userName={context.profile.full_name}
    >
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">Find activity</CardTitle>
                <CardDescription>
                  Review important actions performed across your allowed
                  institute scope.
                </CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0">
                {getPageSummary({
                  page,
                  shownCount: logs.length,
                  totalCount,
                })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <div className="min-w-0">
                  <Label htmlFor="q">Search</Label>
                  <Input
                    className="mt-2"
                    defaultValue={filters.q}
                    id="q"
                    name="q"
                    placeholder="Search record, action, or description"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="actor">Actor</Label>
                  <Input
                    className="mt-2"
                    defaultValue={filters.actor}
                    id="actor"
                    name="actor"
                    placeholder="Search staff member"
                  />
                </div>
                {showBranchFilter ? (
                  <div className="min-w-0">
                    <Label htmlFor="branchId">Branch</Label>
                    <select
                      className={`${controlClass} mt-2`}
                      defaultValue={filters.branchId}
                      id="branchId"
                      name="branchId"
                    >
                      <option value="all">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="min-w-0">
                  <Label htmlFor="entityType">Record type</Label>
                  <select
                    className={`${controlClass} mt-2`}
                    defaultValue={filters.entityType}
                    id="entityType"
                    name="entityType"
                  >
                    <option value="all">All record types</option>
                    {activityEntityTypes.map((entityType) => (
                      <option key={entityType} value={entityType}>
                        {getActivityEntityLabel(entityType)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <Label htmlFor="fromDate">From date</Label>
                  <input
                    className={`${controlClass} mt-2`}
                    defaultValue={filters.fromDate}
                    id="fromDate"
                    name="fromDate"
                    type="date"
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="toDate">To date</Label>
                  <input
                    className={`${controlClass} mt-2`}
                    defaultValue={filters.toDate}
                    id="toDate"
                    name="toDate"
                    type="date"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" type="submit">
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </Button>
                <Button
                  asChild
                  className="w-full sm:w-auto"
                  type="button"
                  variant="outline"
                >
                  <Link href="/dashboard/activity">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <ActionMessage error="Activity records are unavailable right now. Please try again." />
        ) : null}

        {!error && logs.length ? (
          <div className="space-y-3">
            {logs.map((activityLog) => (
              <Card key={activityLog.id}>
                <CardContent className="pt-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Activity
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                        <h2 className="text-lg font-semibold leading-tight">
                          {getActivityActionLabel(activityLog.action)}
                        </h2>
                        <Badge variant="outline">
                          {getActivityEntityLabel(activityLog.entity_type)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {activityLog.entity_label ?? "Record"}
                        </span>
                        <span className="hidden text-muted-foreground/60 sm:inline">
                          |
                        </span>
                        <span className="whitespace-nowrap">
                          {activityLog.actor_name ?? "A staff member"}
                        </span>
                        {activityLog.branch_name ? (
                          <>
                            <span className="hidden text-muted-foreground/60 sm:inline">
                              |
                            </span>
                            <span className="whitespace-nowrap">
                              {activityLog.branch_name}
                            </span>
                          </>
                        ) : null}
                      </div>
                      {activityLog.description ? (
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {activityLog.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-sm text-muted-foreground">
                      {formatDateTime(activityLog.created_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <PaginationControls
              basePath="/dashboard/activity"
              page={page}
              params={paginationParams}
              totalCount={totalCount}
            />
          </div>
        ) : null}

        {!error && !logs.length ? (
          <EmptyState
            title="No recent activity yet"
            description="No activity records match the selected filters."
          />
        ) : null}
      </section>
    </DashboardShell>
  );
}

import Link from "next/link";
import {
  Archive,
  BookOpenCheck,
  CalendarDays,
  Eye,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  archiveHomeworkAssignment,
  createHomeworkAssignment,
  deleteHomeworkAssignment,
  updateHomeworkAssignment,
} from "@/lib/homework/actions";
import {
  listHomeworkAssignments,
  type HomeworkAssignmentRow,
  type HomeworkBatchOption,
  type HomeworkSubmissionStatus,
  type HomeworkStatus,
} from "@/lib/homework/queries";
import { canAccessPermission, hasPermission, type DashboardContext } from "@/lib/auth/permissions";
import { getPageSummary } from "@/lib/dashboard/list-controls";
import { formatDate, formatTimestamp } from "@/lib/formatters/date";

type HomeworkPageProps = {
  searchParams: Promise<{
    batchId?: string;
    branchId?: string;
    dueDate?: string;
    page?: string;
    q?: string;
    status?: string;
    submissionStatus?: string;
  }>;
};

const assignmentStatusLabels: Record<HomeworkStatus, string> = {
  active: "Active",
  archived: "Archived",
  completed: "Completed",
};

const submissionStatusLabels: Record<HomeworkSubmissionStatus, string> = {
  assigned: "Assigned",
  checked: "Checked",
  excused: "Excused",
  late: "Late",
  missing: "Missing",
  submitted: "Submitted",
};

const filterControlClass =
  "box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

function getBranchName(
  context: Pick<DashboardContext, "accessibleBranches">,
  branchId: string,
) {
  return (
    context.accessibleBranches.find((branch) => branch.id === branchId)?.name ??
    "Branch"
  );
}

function getBatchName(batchesById: Map<string, HomeworkBatchOption>, batchId: string) {
  return batchesById.get(batchId)?.name ?? "Batch";
}

function getCurrentPath(filters: {
  batchId: string | null;
  branchId: string | null;
  dueDate: string;
  q: string;
  status: string;
  submissionStatus: string;
}) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.branchId) {
    params.set("branchId", filters.branchId);
  }

  if (filters.batchId) {
    params.set("batchId", filters.batchId);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.submissionStatus) {
    params.set("submissionStatus", filters.submissionStatus);
  }

  if (filters.dueDate) {
    params.set("dueDate", filters.dueDate);
  }

  const queryString = params.toString();

  return queryString ? `/dashboard/homework?${queryString}` : "/dashboard/homework";
}

function getPaginationParams(filters: {
  batchId: string | null;
  branchId: string | null;
  dueDate: string;
  q: string;
  status: string;
  submissionStatus: string;
}) {
  return {
    batchId: filters.batchId,
    branchId: filters.branchId,
    dueDate: filters.dueDate,
    q: filters.q,
    status: filters.status,
    submissionStatus: filters.submissionStatus,
  };
}

function canManageHomeworkBranch(
  context: DashboardContext,
  assignment: Pick<HomeworkAssignmentRow, "batch_id" | "branch_id">,
  permission: "homework.archive" | "homework.delete" | "homework.update",
  visibleBatchIds: Set<string>,
) {
  if (context.role === "teacher") {
    return (
      permission === "homework.update" &&
      visibleBatchIds.has(assignment.batch_id) &&
      hasPermission(context.role, permission)
    );
  }

  return canAccessPermission(context, permission, {
    branchId: assignment.branch_id,
  });
}

function HomeworkBatchSelect({
  batches,
  defaultValue,
  includePlaceholder = true,
  name = "batchId",
  required = false,
}: {
  batches: HomeworkBatchOption[];
  defaultValue?: string | null;
  includePlaceholder?: boolean;
  name?: string;
  required?: boolean;
}) {
  return (
    <select
      className={filterControlClass}
      defaultValue={defaultValue ?? ""}
      name={name}
      required={required}
    >
      {includePlaceholder ? <option value="">All batches</option> : null}
      {batches.map((batch) => (
        <option key={batch.id} value={batch.id}>
          {batch.name}
          {batch.subject ? ` - ${batch.subject}` : ""}
        </option>
      ))}
    </select>
  );
}

function HomeworkStatusSelect({
  defaultValue,
  includePlaceholder = false,
  name = "status",
}: {
  defaultValue?: "" | HomeworkStatus;
  includePlaceholder?: boolean;
  name?: string;
}) {
  return (
    <select
      className={filterControlClass}
      defaultValue={defaultValue ?? "active"}
      name={name}
    >
      {includePlaceholder ? <option value="">All statuses</option> : null}
      <option value="active">Active</option>
      <option value="completed">Completed</option>
      <option value="archived">Archived</option>
    </select>
  );
}

function HomeworkSubmissionStatusSelect({
  defaultValue,
}: {
  defaultValue?: "" | HomeworkSubmissionStatus;
}) {
  return (
    <select
      className={filterControlClass}
      defaultValue={defaultValue ?? ""}
      name="submissionStatus"
    >
      <option value="">All submission statuses</option>
      <option value="assigned">Assigned</option>
      <option value="submitted">Submitted</option>
      <option value="checked">Checked</option>
      <option value="late">Late</option>
      <option value="missing">Missing</option>
      <option value="excused">Excused</option>
    </select>
  );
}

function HomeworkBranchSelect({
  context,
  defaultValue,
  includePlaceholder = true,
  name = "branchId",
}: {
  context: DashboardContext;
  defaultValue?: string | null;
  includePlaceholder?: boolean;
  name?: string;
}) {
  if (context.role !== "owner" || context.accessibleBranches.length <= 1) {
    return null;
  }

  return (
    <Label className="w-full min-w-0">
      Branch
      <select
        className={filterControlClass}
        defaultValue={defaultValue ?? ""}
        name={name}
      >
        {includePlaceholder ? <option value="">All branches</option> : null}
        {context.accessibleBranches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </Label>
  );
}

export default async function HomeworkPage({ searchParams }: HomeworkPageProps) {
  const params = await searchParams;
  const {
    assignments,
    batches,
    context,
    error,
    filters,
    page,
    submissionSummaryByHomeworkId,
    totalCount,
  } = await listHomeworkAssignments(params);
  const { claims, institute, profile, role } = context;
  const currentPath = getCurrentPath(filters);
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const visibleBatchIds = new Set(batches.map((batch) => batch.id));
  const canCreateHomework =
    batches.length > 0 && hasPermission(role, "homework.create");
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.branchId ||
      filters.batchId ||
      filters.status ||
      filters.submissionStatus ||
      filters.dueDate,
  );

  return (
    <DashboardShell
      activePage="homework"
      instituteName={institute.name}
      role={role}
      title="Homework"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find homework</CardTitle>
            <CardDescription>
              Search by title or subject, then filter by branch, batch, status,
              or due date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Label className="min-w-0">
                  Search
                  <Input
                    className={filterControlClass}
                    defaultValue={filters.q}
                    name="q"
                    placeholder="Title or subject"
                    type="search"
                  />
                </Label>
                <HomeworkBranchSelect
                  context={context}
                  defaultValue={filters.branchId}
                />
                <Label className="min-w-0">
                  Batch
                  <HomeworkBatchSelect
                    batches={batches}
                    defaultValue={filters.batchId}
                  />
                </Label>
                <Label className="min-w-0">
                  Status
                  <HomeworkStatusSelect
                    defaultValue={filters.status}
                    includePlaceholder
                  />
                </Label>
                <Label className="min-w-0">
                  Submission status
                  <HomeworkSubmissionStatusSelect
                    defaultValue={filters.submissionStatus}
                  />
                </Label>
                <Label className="min-w-0">
                  Due date
                  <Input
                    className={filterControlClass}
                    defaultValue={filters.dueDate}
                    name="dueDate"
                    type="date"
                  />
                </Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <Button asChild className="w-full sm:w-auto" variant="outline">
                  <Link href="/dashboard/homework">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ActionMessage error={error} />

        <div
          className={
            canCreateHomework
              ? "grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"
              : "grid gap-6"
          }
        >
          {canCreateHomework ? (
            <Card id="create-homework">
              <CardHeader>
                <CardTitle className="text-xl">Create homework</CardTitle>
                <CardDescription>
                  Assign work to a batch with a due date and clear
                  instructions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createHomeworkAssignment} className="grid gap-4">
                  <input name="next" type="hidden" value={currentPath} />
                  <HomeworkBranchSelect
                    context={context}
                    defaultValue={filters.branchId}
                    includePlaceholder={false}
                  />
                  <Label>
                    Batch
                    <HomeworkBatchSelect
                      batches={batches}
                      defaultValue={filters.batchId}
                      includePlaceholder={false}
                      required
                    />
                  </Label>
                  <Label>
                    Title
                    <Input
                      name="title"
                      placeholder="Homework title"
                      required
                      type="text"
                    />
                  </Label>
                  <Label>
                    Subject
                    <Input
                      name="subject"
                      placeholder="Optional subject"
                      type="text"
                    />
                  </Label>
                  <Label>
                    Due date
                    <Input name="dueDate" type="date" />
                  </Label>
                  <Label>
                    Status
                    <HomeworkStatusSelect defaultValue="active" />
                  </Label>
                  <Label>
                    Description
                    <textarea
                      className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                      name="description"
                      placeholder="Instructions, chapters, or problems to complete"
                    />
                  </Label>
                  <SubmitButton pendingLabel="Creating...">
                    <BookOpenCheck
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Create homework
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Homework assignments</CardTitle>
              <CardDescription>
                {getPageSummary({
                  page,
                  shownCount: assignments.length,
                  totalCount,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length ? (
                <div className="grid gap-4">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {assignments.map((homework) => {
                      const batch = batchesById.get(homework.batch_id);
                      const branchName = getBranchName(
                        context,
                        homework.branch_id,
                      );
                      const canUpdateHomework = canManageHomeworkBranch(
                        context,
                        homework,
                        "homework.update",
                        visibleBatchIds,
                      );
                      const canArchiveHomework =
                        homework.status !== "archived" &&
                        canManageHomeworkBranch(
                          context,
                          homework,
                          "homework.archive",
                          visibleBatchIds,
                        );
                      const submissionSummary =
                        submissionSummaryByHomeworkId.get(homework.id);
                      const totalSubmissions = submissionSummary
                        ? Object.values(submissionSummary).reduce(
                            (total, count) => total + count,
                            0,
                          )
                        : 0;
                      const submittedCount = submissionSummary
                        ? submissionSummary.submitted +
                          submissionSummary.checked +
                          submissionSummary.late
                        : 0;
                      const checkedCount = submissionSummary?.checked ?? 0;
                      const canDeleteHomework =
                        totalSubmissions === 0 &&
                        canManageHomeworkBranch(
                        context,
                        homework,
                        "homework.delete",
                        visibleBatchIds,
                      );

                      return (
                        <article key={homework.id} className="grid gap-4 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-base font-semibold tracking-tight">
                                {homework.title}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                <span className="whitespace-nowrap">
                                  {homework.subject ?? batch?.subject ?? "No subject"}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="hidden text-muted-foreground/60 sm:inline"
                                >
                                  |
                                </span>
                                <span className="whitespace-nowrap">
                                  {getBatchName(batchesById, homework.batch_id)}
                                </span>
                                <span
                                  aria-hidden="true"
                                  className="hidden text-muted-foreground/60 sm:inline"
                                >
                                  |
                                </span>
                                <span className="whitespace-nowrap">
                                  {branchName}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-start justify-start gap-2 sm:justify-end">
                              <Badge
                                variant={
                                  homework.status === "archived"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {assignmentStatusLabels[homework.status]}
                              </Badge>
                              <Badge variant="outline">
                                Due {formatDate(homework.due_date)}
                              </Badge>
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/homework/${homework.id}`}
                                >
                                  <Eye
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                  />
                                  View submissions
                                </Link>
                              </Button>
                              {canArchiveHomework ? (
                                <form action={archiveHomeworkAssignment}>
                                  <input
                                    name="homeworkId"
                                    type="hidden"
                                    value={homework.id}
                                  />
                                  <input
                                    name="next"
                                    type="hidden"
                                    value={currentPath}
                                  />
                                  <ConfirmSubmitButton
                                    confirmDescription="This will move the homework out of the active assignment list while keeping the record available for reference."
                                    confirmLabel="Archive homework"
                                    confirmMessage={`Archive ${homework.title}?`}
                                    confirmTitle="Archive homework?"
                                    pendingLabel="Archiving..."
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Archive
                                      aria-hidden="true"
                                      data-icon="inline-start"
                                    />
                                    Archive
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                              {canDeleteHomework ? (
                                <form action={deleteHomeworkAssignment}>
                                  <input
                                    name="homeworkId"
                                    type="hidden"
                                    value={homework.id}
                                  />
                                  <input
                                    name="next"
                                    type="hidden"
                                    value={currentPath}
                                  />
                                  <ConfirmSubmitButton
                                    confirmDescription="This will permanently delete this homework assignment. This action cannot be undone."
                                    confirmLabel="Delete homework"
                                    confirmMessage={`Delete ${homework.title}?`}
                                    confirmTitle="Delete homework?"
                                    pendingLabel="Deleting..."
                                    size="sm"
                                    variant="destructive"
                                  >
                                    <Trash2
                                      aria-hidden="true"
                                      data-icon="inline-start"
                                    />
                                    Delete
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {submittedCount} / {totalSubmissions} submitted
                              </Badge>
                              <Badge variant="outline">
                                {checkedCount} checked
                              </Badge>
                              {submissionSummary
                                ? Object.entries(submissionSummary).map(
                                    ([status, count]) =>
                                      count > 0 ? (
                                        <span
                                          key={status}
                                          className="text-xs text-muted-foreground"
                                        >
                                          {
                                            submissionStatusLabels[
                                              status as HomeworkSubmissionStatus
                                            ]
                                          }
                                          : {count}
                                        </span>
                                      ) : null,
                                  )
                                : null}
                            </div>
                            <p>
                              {homework.description ||
                                "No description has been added."}
                            </p>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <CalendarDays
                                aria-hidden="true"
                                className="size-4"
                              />
                              Created {formatTimestamp(homework.created_at)}
                            </p>
                          </div>

                          {canUpdateHomework ? (
                            <details className="rounded-md border border-border bg-muted/30 p-3">
                              <summary className="cursor-pointer text-sm font-medium">
                                Edit homework
                              </summary>
                              <form
                                action={updateHomeworkAssignment}
                                className="mt-4 grid gap-3 sm:grid-cols-2"
                              >
                                <input
                                  name="homeworkId"
                                  type="hidden"
                                  value={homework.id}
                                />
                                <input
                                  name="next"
                                  type="hidden"
                                  value={currentPath}
                                />
                                {role === "owner" &&
                                context.accessibleBranches.length > 1 ? (
                                  <HomeworkBranchSelect
                                    context={context}
                                    defaultValue={homework.branch_id}
                                    includePlaceholder={false}
                                  />
                                ) : (
                                  <input
                                    name="branchId"
                                    type="hidden"
                                    value={homework.branch_id}
                                  />
                                )}
                                <Label>
                                  Batch
                                  <HomeworkBatchSelect
                                    batches={batches}
                                    defaultValue={homework.batch_id}
                                    includePlaceholder={false}
                                    required
                                  />
                                </Label>
                                <Label>
                                  Title
                                  <Input
                                    defaultValue={homework.title}
                                    name="title"
                                    required
                                    type="text"
                                  />
                                </Label>
                                <Label>
                                  Subject
                                  <Input
                                    defaultValue={homework.subject ?? ""}
                                    name="subject"
                                    type="text"
                                  />
                                </Label>
                                <Label>
                                  Due date
                                  <Input
                                    defaultValue={homework.due_date ?? ""}
                                    name="dueDate"
                                    type="date"
                                  />
                                </Label>
                                <Label>
                                  Status
                                  <HomeworkStatusSelect
                                    defaultValue={homework.status}
                                  />
                                </Label>
                                <Label className="sm:col-span-2">
                                  Description
                                  <textarea
                                    className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                                    defaultValue={homework.description ?? ""}
                                    name="description"
                                  />
                                </Label>
                                <SubmitButton
                                  className="sm:col-span-2 sm:w-fit"
                                  pendingLabel="Updating..."
                                >
                                  <Save
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                  />
                                  Save changes
                                </SubmitButton>
                              </form>
                            </details>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/homework"
                    page={page}
                    params={getPaginationParams(filters)}
                    totalCount={totalCount}
                  />
                </div>
              ) : (
                <EmptyState
                  actionHref={
                    canCreateHomework && !hasActiveFilters
                      ? "#create-homework"
                      : undefined
                  }
                  actionLabel={
                    canCreateHomework && !hasActiveFilters
                      ? "Create homework"
                      : undefined
                  }
                  description={
                    hasActiveFilters
                      ? "No homework assignments match the selected filters."
                      : "No homework has been assigned yet."
                  }
                  title={
                    hasActiveFilters
                      ? "No matching homework"
                      : "No homework assigned"
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardShell>
  );
}

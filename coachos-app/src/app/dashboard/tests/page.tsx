import Link from "next/link";
import {
  Archive,
  ClipboardCheck,
  CalendarDays,
  Save,
  Search,
  Trash2,
  FileSpreadsheet,
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
  createTest,
  updateTest,
  archiveTest,
  deleteTest,
} from "@/lib/tests/actions";
import {
  listTests,
  type TestRow,
  type TestStatus,
} from "@/lib/tests/queries";
import { canAccessPermission, hasPermission, type DashboardContext } from "@/lib/auth/permissions";
import { getPageSummary } from "@/lib/dashboard/list-controls";
import { formatDate } from "@/lib/formatters/date";

type TestsPageProps = {
  searchParams: Promise<{
    batchId?: string;
    branchId?: string;
    status?: string;
    testDate?: string;
    page?: string;
    q?: string;
    error?: string;
    success?: string;
  }>;
};

const statusLabels: Record<TestStatus, string> = {
  scheduled: "Scheduled",
  marks_entry: "Marks Entry",
  completed: "Completed",
  archived: "Archived",
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


function getCurrentPath(filters: {
  batchId: string | null;
  branchId: string | null;
  status: TestStatus | null;
  testDate: string;
  q: string;
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

  if (filters.testDate) {
    params.set("testDate", filters.testDate);
  }

  const queryString = params.toString();

  return queryString ? `/dashboard/tests?${queryString}` : "/dashboard/tests";
}

function getPaginationParams(filters: {
  batchId: string | null;
  branchId: string | null;
  status: TestStatus | null;
  testDate: string;
  q: string;
}) {
  return {
    batchId: filters.batchId ?? undefined,
    branchId: filters.branchId ?? undefined,
    status: filters.status ?? undefined,
    testDate: filters.testDate || undefined,
    q: filters.q || undefined,
  };
}

function canManageTestBranch(
  context: DashboardContext,
  test: Pick<TestRow, "batch_id" | "branch_id">,
  permission: "tests.archive" | "tests.delete" | "tests.update",
  visibleBatchIds: Set<string>,
) {
  if (context.role === "teacher") {
    return (
      permission === "tests.update" &&
      visibleBatchIds.has(test.batch_id) &&
      hasPermission(context.role, permission)
    );
  }

  return canAccessPermission(context, permission, {
    branchId: test.branch_id,
  });
}

function TestBatchSelect({
  batches,
  defaultValue,
  includePlaceholder = true,
  name = "batchId",
  required = false,
}: {
  batches: Array<{ id: string; name: string; subject: string | null }>;
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

function TestStatusSelect({
  defaultValue,
  includePlaceholder = false,
  name = "status",
}: {
  defaultValue?: "" | TestStatus;
  includePlaceholder?: boolean;
  name?: string;
}) {
  return (
    <select
      className={filterControlClass}
      defaultValue={defaultValue ?? "scheduled"}
      name={name}
    >
      {includePlaceholder ? <option value="">All statuses</option> : null}
      <option value="scheduled">Scheduled</option>
      <option value="marks_entry">Marks Entry</option>
      <option value="completed">Completed</option>
      <option value="archived">Archived</option>
    </select>
  );
}

function TestBranchSelect({
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

export default async function TestsPage({ searchParams }: TestsPageProps) {
  const params = await searchParams;
  const {
    tests,
    batches,
    context,
    filters,
    page,
    totalCount,
  } = await listTests(params);
  const { claims, institute, profile, role } = context;
  const currentPath = getCurrentPath(filters);
  const visibleBatchIds = new Set(batches.map((batch) => batch.id));
  const canCreateTest = batches.length > 0 && hasPermission(role, "tests.create");
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.branchId ||
      filters.batchId ||
      filters.status ||
      filters.testDate,
  );

  return (
    <DashboardShell
      activePage="tests"
      instituteName={institute.name}
      role={role}
      title="Tests & Exams"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find tests & exams</CardTitle>
            <CardDescription>
              Search by test title or subject, then filter by branch, batch, status, or test date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
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
                <TestBranchSelect
                  context={context}
                  defaultValue={filters.branchId}
                />
                <Label className="min-w-0">
                  Batch
                  <TestBatchSelect
                    batches={batches}
                    defaultValue={filters.batchId}
                  />
                </Label>
                <Label className="min-w-0">
                  Status
                  <TestStatusSelect
                    defaultValue={filters.status ?? ""}
                    includePlaceholder
                  />
                </Label>
                <Label className="min-w-0">
                  Test date
                  <Input
                    className={filterControlClass}
                    defaultValue={filters.testDate}
                    name="testDate"
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
                  <Link href="/dashboard/tests">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ActionMessage error={params.error} success={params.success} />

        <div
          className={
            canCreateTest
              ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
              : "grid gap-6"
          }
        >
          {canCreateTest ? (
            <Card id="create-test">
              <CardHeader>
                <CardTitle className="text-xl">Create test</CardTitle>
                <CardDescription>
                  Schedule a new test for a batch and specify maximum marks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createTest} className="grid gap-4">
                  <input name="next" type="hidden" value={currentPath} />
                  <TestBranchSelect
                    context={context}
                    defaultValue={filters.branchId}
                    includePlaceholder={false}
                  />
                  <Label>
                    Batch
                    <TestBatchSelect
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
                      placeholder="Test title"
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
                    Test date
                    <Input name="testDate" required type="date" />
                  </Label>
                  <Label>
                    Maximum marks
                    <Input
                      name="maxMarks"
                      placeholder="e.g. 100"
                      required
                      step="0.01"
                      type="number"
                    />
                  </Label>
                  <Label>
                    Status
                    <TestStatusSelect defaultValue="scheduled" />
                  </Label>
                  <Label>
                    Description
                    <textarea
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                      name="description"
                      placeholder="Chapters covered, pattern, or instructions"
                    />
                  </Label>
                  <SubmitButton pendingLabel="Creating...">
                    <ClipboardCheck
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Create test
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="text-xl">Tests & Exams</CardTitle>
                <CardDescription>
                  {getPageSummary({
                    page,
                    shownCount: tests.length,
                    totalCount,
                  })}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {tests.length ? (
                <div className="grid gap-6">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {tests.map((test) => {
                      const canUpdateTest = canManageTestBranch(
                        context,
                        test,
                        "tests.update",
                        visibleBatchIds,
                      );
                      const canArchiveTest = canManageTestBranch(
                        context,
                        test,
                        "tests.archive",
                        visibleBatchIds,
                      );
                      const canDeleteTest = canManageTestBranch(
                        context,
                        test,
                        "tests.delete",
                        visibleBatchIds,
                      );

                      return (
                        <article key={test.id} className="grid gap-4 p-5">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-lg font-semibold leading-tight text-foreground">
                                <Link
                                  href={`/dashboard/tests/${test.id}`}
                                  className="hover:underline"
                                >
                                  {test.title}
                                </Link>
                              </h3>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="whitespace-nowrap font-medium">
                                  {test.batches?.name ?? "Batch"}
                                </span>
                                <span className="inline-flex items-center gap-x-2 whitespace-nowrap">
                                  <span
                                    aria-hidden="true"
                                    className="hidden text-muted-foreground/60 sm:inline"
                                  >
                                    |
                                  </span>
                                  <span>{test.subject ?? "No subject"}</span>
                                </span>
                                <span className="inline-flex items-center gap-x-2 whitespace-nowrap">
                                  <span
                                    aria-hidden="true"
                                    className="hidden text-muted-foreground/60 sm:inline"
                                  >
                                    |
                                  </span>
                                  <span>
                                    {getBranchName(context, test.branch_id)}
                                  </span>
                                </span>
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                              <Badge
                                variant={
                                  test.status === "completed"
                                    ? "secondary"
                                    : test.status === "marks_entry"
                                      ? "default"
                                      : "outline"
                                }
                              >
                                {statusLabels[test.status]}
                              </Badge>
                              <Badge variant="outline">
                                Max {test.max_marks} marks
                              </Badge>
                            </div>
                          </div>

                          <div className="grid gap-2 text-sm text-muted-foreground">
                            {test.description ? (
                              <p className="line-clamp-2">{test.description}</p>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                              <span className="flex items-center gap-1.5">
                                <CalendarDays className="size-3.5" />
                                Test Date: {formatDate(test.test_date)}
                              </span>
                              <span className="font-medium text-foreground">
                                Progress: {test.score_entered_count ?? 0} / {test.score_total_count ?? 0} marks entered
                                {test.average_score !== undefined && test.average_score !== null ? (
                                  <span className="ml-2 pl-2 border-l border-border">
                                    Avg: {Number(test.average_score).toFixed(2)}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/dashboard/tests/${test.id}`}>
                                <FileSpreadsheet className="size-3.5 mr-1" />
                                View scores
                              </Link>
                            </Button>

                            {canArchiveTest && test.status !== "archived" ? (
                              <form action={archiveTest}>
                                <input name="testId" type="hidden" value={test.id} />
                                <input name="next" type="hidden" value={currentPath} />
                                <ConfirmSubmitButton
                                  confirmDescription="This will archive the test, moving it out of the active test workflows."
                                  confirmLabel="Archive test"
                                  confirmMessage={`Archive ${test.title}?`}
                                  confirmTitle="Archive test?"
                                  pendingLabel="Archiving..."
                                  size="sm"
                                  variant="outline"
                                >
                                  <Archive aria-hidden="true" data-icon="inline-start" />
                                  Archive
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}

                            {canDeleteTest ? (
                              <form action={deleteTest}>
                                <input name="testId" type="hidden" value={test.id} />
                                <input name="next" type="hidden" value={currentPath} />
                                <ConfirmSubmitButton
                                  confirmDescription="This will permanently delete this test and all entered student scores. This action cannot be undone."
                                  confirmLabel="Delete test"
                                  confirmMessage={`Delete ${test.title}?`}
                                  confirmTitle="Delete test?"
                                  pendingLabel="Deleting..."
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Trash2 aria-hidden="true" data-icon="inline-start" />
                                  Delete
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>

                          {canUpdateTest ? (
                            <details className="mt-2 rounded-md border border-border bg-muted/30 p-4">
                              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
                                Edit details
                              </summary>
                              <form
                                action={updateTest}
                                className="mt-4 grid gap-3 sm:grid-cols-2"
                              >
                                <input name="testId" type="hidden" value={test.id} />
                                <input name="next" type="hidden" value={currentPath} />
                                {role === "owner" && context.accessibleBranches.length > 1 ? (
                                  <TestBranchSelect
                                    context={context}
                                    defaultValue={test.branch_id}
                                    includePlaceholder={false}
                                  />
                                ) : (
                                  <input name="branchId" type="hidden" value={test.branch_id} />
                                )}
                                <Label>
                                  Batch
                                  <TestBatchSelect
                                    batches={batches}
                                    defaultValue={test.batch_id}
                                    includePlaceholder={false}
                                    required
                                  />
                                </Label>
                                <Label>
                                  Title
                                  <Input
                                    defaultValue={test.title}
                                    name="title"
                                    required
                                    type="text"
                                  />
                                </Label>
                                <Label>
                                  Subject
                                  <Input
                                    defaultValue={test.subject ?? ""}
                                    name="subject"
                                    type="text"
                                  />
                                </Label>
                                <Label>
                                  Test date
                                  <Input
                                    defaultValue={test.test_date}
                                    name="testDate"
                                    required
                                    type="date"
                                  />
                                </Label>
                                <Label>
                                  Maximum marks
                                  <Input
                                    defaultValue={test.max_marks}
                                    name="maxMarks"
                                    required
                                    step="0.01"
                                    type="number"
                                  />
                                </Label>
                                <Label>
                                  Status
                                  <TestStatusSelect defaultValue={test.status} />
                                </Label>
                                <Label className="sm:col-span-2">
                                  Description
                                  <textarea
                                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                                    defaultValue={test.description ?? ""}
                                    name="description"
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
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/tests"
                    page={page}
                    params={getPaginationParams(filters)}
                    totalCount={totalCount}
                  />
                </div>
              ) : (
                <EmptyState
                  actionHref={
                    canCreateTest && !hasActiveFilters
                      ? "#create-test"
                      : undefined
                  }
                  actionLabel={
                    canCreateTest && !hasActiveFilters
                      ? "Create test"
                      : undefined
                  }
                  description={
                    hasActiveFilters
                      ? "No tests match the selected filters."
                      : "No tests have been created yet."
                  }
                  title={
                    hasActiveFilters
                      ? "No matching tests"
                      : "No tests created yet."
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

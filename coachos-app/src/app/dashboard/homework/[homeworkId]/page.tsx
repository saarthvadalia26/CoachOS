import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  RefreshCw,
  Save,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { canAccessPermission } from "@/lib/auth/permissions";
import {
  bulkUpdateHomeworkSubmissions,
  syncHomeworkSubmissionsForBatch,
  updateHomeworkSubmissionRemarks,
  updateHomeworkSubmissionStatus,
} from "@/lib/homework/actions";
import {
  homeworkSubmissionStatuses,
  listHomeworkSubmissions,
  type HomeworkSubmissionStatus,
  type HomeworkStatus,
} from "@/lib/homework/queries";
import { formatDate, formatTimestamp } from "@/lib/formatters/date";

export const metadata: Metadata = {
  title: "Homework Submissions",
};

type HomeworkDetailPageProps = {
  params: Promise<{
    homeworkId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
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

function getSubmissionBadgeVariant(
  status: HomeworkSubmissionStatus,
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "checked") {
    return "secondary";
  }

  if (status === "missing") {
    return "destructive";
  }

  if (status === "submitted" || status === "late") {
    return "default";
  }

  return "outline";
}

function getAssignmentBadgeVariant(
  status: HomeworkStatus,
): "outline" | "secondary" {
  return status === "archived" ? "outline" : "secondary";
}

function HomeworkSubmissionStatusSelect({
  defaultValue,
  name = "status",
}: {
  defaultValue?: HomeworkSubmissionStatus;
  name?: string;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      defaultValue={defaultValue ?? "submitted"}
      name={name}
    >
      {homeworkSubmissionStatuses.map((status) => (
        <option key={status} value={status}>
          {submissionStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

export default async function HomeworkDetailPage({
  params,
  searchParams,
}: HomeworkDetailPageProps) {
  const { homeworkId } = await params;
  const query = await searchParams;
  const {
    batch,
    context,
    createdByName,
    error: loadError,
    homework,
    submissions,
    summary,
  } = await listHomeworkSubmissions(homeworkId);
  const { claims, institute, profile, role } = context;
  const currentPath = `/dashboard/homework/${homework.id}`;
  const canUpdateSubmissions =
    homework.status !== "archived" &&
    canAccessPermission(context, "homework.update", {
      branchId: homework.branch_id,
    });
  const totalSubmissions = submissions.length;
  const submittedTotal =
    summary.submitted + summary.checked + summary.late;

  return (
    <DashboardShell
      activePage="homework"
      instituteName={institute.name}
      role={role}
      title="Homework Submissions"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/homework">
                <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                Back to homework
              </Link>
            </Button>
            <h1 className="mt-4 break-words text-3xl font-semibold tracking-tight">
              {homework.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {homework.description || "No description has been added."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
            <Badge variant={getAssignmentBadgeVariant(homework.status)}>
              {assignmentStatusLabels[homework.status]}
            </Badge>
            <Badge variant="outline">
              Due {formatDate(homework.due_date)}
            </Badge>
            <Badge variant="outline">
              {submittedTotal} / {totalSubmissions} submitted
            </Badge>
          </div>
        </div>

        <ActionMessage error={query.error ?? loadError} />

        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Batch
              </p>
              <p className="mt-2 break-words text-xl font-semibold">
                {batch?.name ?? "Batch not available"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {homework.subject ?? batch?.subject ?? "Subject not specified"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Branch
              </p>
              <p className="mt-2 text-xl font-semibold">
                {context.accessibleBranches.find(
                  (branch) => branch.id === homework.branch_id,
                )?.name ?? "Branch"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatTimestamp(homework.created_at)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Created by
              </p>
              <p className="mt-2 break-words text-xl font-semibold">
                {createdByName ?? "Staff member"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Updated {formatTimestamp(homework.updated_at)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardCheck aria-hidden="true" className="size-4" />
                Submission progress
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {submittedTotal} / {totalSubmissions}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Submitted, late, or checked
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Submission summary</CardTitle>
            <CardDescription>
              Student-level status counts for this homework assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {homeworkSubmissionStatuses.map((status) => (
                <div
                  className="rounded-md border border-border p-3"
                  key={status}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {submissionStatusLabels[status]}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {summary[status]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-xl">Student submissions</CardTitle>
              <CardDescription>
                Track submission status and review remarks for each assigned
                student.
              </CardDescription>
            </div>
            {canUpdateSubmissions ? (
              <form
                action={syncHomeworkSubmissionsForBatch}
                className="shrink-0"
              >
                <input name="homeworkId" type="hidden" value={homework.id} />
                <input name="next" type="hidden" value={currentPath} />
                <SubmitButton
                  pendingLabel="Syncing..."
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" data-icon="inline-start" />
                  Sync students
                </SubmitButton>
              </form>
            ) : null}
          </CardHeader>
          <CardContent>
            {canUpdateSubmissions && submissions.length ? (
              <form
                action={bulkUpdateHomeworkSubmissions}
                className="mb-4 grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                id="bulk-homework-submissions"
              >
                <input name="homeworkId" type="hidden" value={homework.id} />
                <input name="next" type="hidden" value={currentPath} />
                <Label className="min-w-0">
                  Bulk update selected students
                  <HomeworkSubmissionStatusSelect defaultValue="submitted" />
                </Label>
                <SubmitButton
                  className="self-end"
                  pendingLabel="Updating..."
                  variant="secondary"
                >
                  <Save aria-hidden="true" data-icon="inline-start" />
                  Update selected
                </SubmitButton>
              </form>
            ) : null}

            {submissions.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {submissions.map((submission) => {
                  const studentName =
                    submission.student?.full_name ?? "Student record";
                  const studentPhone =
                    submission.student?.phone ?? "Phone not added";

                  return (
                    <article className="grid gap-4 p-4" key={submission.id}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {canUpdateSubmissions ? (
                              <input
                                aria-label={`Select ${studentName}`}
                                className="size-4 rounded border-input"
                                form="bulk-homework-submissions"
                                name="submissionId"
                                type="checkbox"
                                value={submission.id}
                              />
                            ) : null}
                            <h3 className="break-words text-sm font-semibold">
                              {studentName}
                            </h3>
                            {submission.student?.archived_at ? (
                              <Badge variant="outline">Archived</Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">
                              {studentPhone}
                            </span>
                            <span
                              aria-hidden="true"
                              className="hidden text-muted-foreground/60 sm:inline"
                            >
                              |
                            </span>
                            <span className="whitespace-nowrap">
                              Created {formatTimestamp(submission.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
                          <Badge
                            variant={getSubmissionBadgeVariant(
                              submission.status,
                            )}
                          >
                            {submissionStatusLabels[submission.status]}
                          </Badge>
                          <Badge variant="outline">
                            Submitted {formatTimestamp(submission.submitted_at)}
                          </Badge>
                          <Badge variant="outline">
                            Checked {formatTimestamp(submission.checked_at)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <p className="text-xs font-medium text-muted-foreground">
                            Remarks
                          </p>
                          <p className="mt-1 break-words text-sm">
                            {submission.remarks || "No remarks added."}
                          </p>
                        </div>

                        {canUpdateSubmissions ? (
                          <div className="grid gap-3">
                            <form
                              action={updateHomeworkSubmissionStatus}
                              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <input
                                name="submissionId"
                                type="hidden"
                                value={submission.id}
                              />
                              <input
                                name="next"
                                type="hidden"
                                value={currentPath}
                              />
                              <HomeworkSubmissionStatusSelect
                                defaultValue={submission.status}
                              />
                              <SubmitButton
                                pendingLabel="Updating..."
                                size="sm"
                                variant="outline"
                              >
                                Update status
                              </SubmitButton>
                            </form>
                            <form
                              action={updateHomeworkSubmissionRemarks}
                              className="grid gap-2"
                            >
                              <input
                                name="submissionId"
                                type="hidden"
                                value={submission.id}
                              />
                              <input
                                name="next"
                                type="hidden"
                                value={currentPath}
                              />
                              <Label>
                                Remarks
                                <textarea
                                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                                  defaultValue={submission.remarks ?? ""}
                                  name="remarks"
                                  placeholder="Add review notes or follow-up details"
                                />
                              </Label>
                              <SubmitButton
                                className="w-full sm:w-fit"
                                pendingLabel="Saving..."
                                size="sm"
                                variant="secondary"
                              >
                                Save remarks
                              </SubmitButton>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No student submissions yet"
                description={
                  canUpdateSubmissions
                    ? "Sync students from the batch to create submission records for this homework."
                    : "No submission records are available for this homework."
                }
              >
                {canUpdateSubmissions ? (
                  <form action={syncHomeworkSubmissionsForBatch}>
                    <input
                      name="homeworkId"
                      type="hidden"
                      value={homework.id}
                    />
                    <input name="next" type="hidden" value={currentPath} />
                    <SubmitButton pendingLabel="Syncing..." variant="outline">
                      <RefreshCw aria-hidden="true" data-icon="inline-start" />
                      Sync students
                    </SubmitButton>
                  </form>
                ) : null}
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4" />
          Assignment status and student submission status are tracked
          separately.
        </p>
      </section>
    </DashboardShell>
  );
}

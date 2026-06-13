import {
  ArrowLeft,
  CalendarCheck,
  Phone,
  RotateCcw,
  UserRound,
  UsersRound,
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
import { SubmitButton } from "@/components/ui/submit-button";
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getFeeStatus, type FeeStatus } from "@/lib/fees/status";
import { formatDate } from "@/lib/formatters/date";
import { reactivateStudent } from "@/lib/students/actions";

export const metadata: Metadata = {
  title: "Student Profile",
};

type StudentProfilePageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

type StudentProfile = {
  archived_at: string | null;
  archived_by: string | null;
  branch_id: string;
  full_name: string;
  id: string;
  institute_id: string;
  parent_phone: string | null;
  phone: string | null;
  status: string | null;
};

type StudentBatch = {
  batch_id: string;
};

type Batch = {
  branch_id: string;
  id: string;
  name: string;
  schedule: string | null;
  subject: string | null;
};

type AttendanceSession = {
  batch_id: string;
  branch_id: string;
  id: string;
  locked_at: string | null;
  notes: string | null;
  session_date: string;
};

type AttendanceRecord = {
  created_at: string | null;
  id: string;
  session_id: string;
  status: string | null;
  student_id: string;
};

type AttendanceEntry = AttendanceRecord & {
  batch: Batch | null;
  session: AttendanceSession;
};

type AttendanceStatus = "present" | "absent" | "late";

type FeeRecord = {
  amount_due: number | string;
  amount_paid: number | string;
  created_at: string | null;
  due_date: string | null;
  id: string;
  notes: string | null;
  status: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function toAmount(value: number | string) {
  return Number(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function getStudentStatusLabel(status: string | null) {
  return status === "inactive" ? "Inactive" : "Active";
}

function getAttendanceStatus(status: string | null): AttendanceStatus {
  if (status === "absent" || status === "late") {
    return status;
  }

  return "present";
}

function getAttendanceStatusLabel(status: string | null) {
  const normalizedStatus = getAttendanceStatus(status);

  if (normalizedStatus === "absent") {
    return "Absent";
  }

  if (normalizedStatus === "late") {
    return "Late";
  }

  return "Present";
}

function getAttendanceBadgeVariant(
  status: AttendanceStatus,
): "outline" | "secondary" | "destructive" {
  if (status === "present") {
    return "secondary";
  }

  if (status === "absent") {
    return "destructive";
  }

  return "outline";
}

function getFeeBadgeVariant(status: FeeStatus) {
  if (status === "paid") {
    return "secondary";
  }

  if (status === "overdue") {
    return "destructive";
  }

  return "outline";
}

function getAttendancePercentage(
  counts: Record<AttendanceStatus, number>,
  totalRecords: number,
) {
  if (!totalRecords) {
    return "0%";
  }

  return `${Math.round(((counts.present + counts.late) / totalRecords) * 100)}%`;
}

function getSupabaseErrorDetails(error: unknown) {
  const supabaseError = error as SupabaseErrorLike | null;

  return {
    code: supabaseError?.code ?? null,
    details: supabaseError?.details ?? null,
    hint: supabaseError?.hint ?? null,
    message:
      supabaseError?.message ??
      (error instanceof Error ? error.message : "Unknown Supabase error"),
  };
}

function logStudentProfileQueryError(
  queryName: string,
  error: unknown,
  context: {
    instituteId: string;
    role: string | null;
    studentId: string;
    userId: string;
  },
) {
  if (!error) {
    return false;
  }

  console.error("Student profile data load failed", {
    instituteId: context.instituteId,
    queryName,
    role: context.role,
    studentId: context.studentId,
    supabaseError: getSupabaseErrorDetails(error),
    userId: context.userId,
  });

  return true;
}

function getUnavailableProfileCard(message: string) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Student profile unavailable</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/dashboard/students">
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            Back to students
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function getBatchProfileHref(batch: Batch) {
  const search = new URLSearchParams({
    branchId: batch.branch_id,
    q: batch.name,
  });

  return `/dashboard/batches?${search.toString()}`;
}

export default async function StudentProfilePage({
  params,
}: StudentProfilePageProps) {
  const { studentId } = await params;
  const context = await requirePermission("students.view");
  const { accessibleBranches, claims, institute, profile, role, supabase } =
    context;
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const logQueryError = (queryName: string, error: unknown) =>
    logStudentProfileQueryError(queryName, error, {
      instituteId: institute.id,
      role,
      studentId,
      userId: claims.sub,
    });

  const { data: studentRow, error: studentError } = await supabase
    .from("students")
    .select(
      "id, institute_id, branch_id, full_name, phone, parent_phone, status, archived_at, archived_by",
    )
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  const hasStudentError = logQueryError("student_profile", studentError);
  const student = studentRow as StudentProfile | null;
  const hasBranchAccess = student
    ? branchesById.has(student.branch_id)
    : false;

  return (
    <DashboardShell
      activePage="students"
      instituteName={institute.name}
      role={role}
      title="Student Profile"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      {student && hasBranchAccess ? (
        <StudentProfileContent
          context={context}
          logQueryError={logQueryError}
          student={student}
        />
      ) : (
        <section className="grid gap-6">
          <ActionMessage
            error={
              hasStudentError
                ? "Student profile information is unavailable right now. Please try again."
                : null
            }
          />
          {getUnavailableProfileCard(
            "This student record was not found or your account does not have access to it.",
          )}
        </section>
      )}
    </DashboardShell>
  );
}

async function StudentProfileContent({
  context,
  logQueryError,
  student,
}: {
  context: Awaited<ReturnType<typeof requirePermission>>;
  logQueryError: (queryName: string, error: unknown) => boolean;
  student: StudentProfile;
}) {
  const { accessibleBranches, role, supabase } = context;
  const branch = accessibleBranches.find(
    (accessibleBranch) => accessibleBranch.id === student.branch_id,
  );
  const canViewBatchDetails = canAccessPermission(
    context,
    "batches.view",
    { branchId: student.branch_id },
  );
  const canViewAttendanceDetails = canAccessPermission(
    context,
    "attendance.view",
    { branchId: student.branch_id },
  );
  const canViewFeeDetails = canAccessPermission(context, "fees.view", {
    branchId: student.branch_id,
  });
  const canReactivateStudent =
    Boolean(student.archived_at) &&
    (role === "owner" ||
      canAccessPermission(context, "students.update", {
        branchId: student.branch_id,
      }));
  let queryError = false;
  let assignedBatches: Batch[] = [];
  let attendanceEntries: AttendanceEntry[] = [];
  let feeRecords: Array<
    FeeRecord & {
      amountDue: number;
      amountPaid: number;
      pendingAmount: number;
      computedStatus: FeeStatus;
    }
  > = [];

  if (canViewBatchDetails || canViewAttendanceDetails) {
    const { data: studentBatchRows, error: studentBatchesError } =
      await supabase
        .from("student_batches")
        .select("batch_id")
        .eq("student_id", student.id);

    queryError =
      logQueryError("student_batch_assignments", studentBatchesError) ||
      queryError;

    const batchIds = Array.from(
      new Set(
        ((studentBatchRows ?? []) as StudentBatch[])
          .map((studentBatch) => studentBatch.batch_id)
          .filter(Boolean),
      ),
    );

    if (batchIds.length) {
      const { data: batchRows, error: batchesError } = await supabase
        .from("batches")
        .select("id, branch_id, name, subject, schedule")
        .eq("institute_id", student.institute_id)
        .eq("branch_id", student.branch_id)
        .in("id", batchIds)
        .order("created_at", { ascending: false });

      assignedBatches = (batchRows ?? []) as Batch[];
      queryError =
        logQueryError("student_assigned_batches", batchesError) || queryError;
    }
  }

  const batchIdsForAttendance = assignedBatches.map((batch) => batch.id);
  const batchesById = new Map(assignedBatches.map((batch) => [batch.id, batch]));

  if (canViewAttendanceDetails && batchIdsForAttendance.length) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, batch_id, branch_id, session_date, notes, locked_at")
      .eq("institute_id", student.institute_id)
      .eq("branch_id", student.branch_id)
      .in("batch_id", batchIdsForAttendance)
      .order("session_date", { ascending: false });

    queryError =
      logQueryError("student_attendance_sessions", sessionsError) ||
      queryError;

    const attendanceSessions = (sessionRows ?? []) as AttendanceSession[];
    const sessionsById = new Map(
      attendanceSessions.map((session) => [session.id, session]),
    );
    const sessionIds = attendanceSessions.map((session) => session.id);

    if (sessionIds.length) {
      const { data: attendanceRecordRows, error: recordsError } = await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status, created_at")
        .eq("student_id", student.id)
        .in("session_id", sessionIds);

      queryError =
        logQueryError("student_attendance_records", recordsError) ||
        queryError;

      attendanceEntries = ((attendanceRecordRows ?? []) as AttendanceRecord[])
        .map((record) => {
          const session = sessionsById.get(record.session_id);

          if (!session) {
            return null;
          }

          return {
            ...record,
            batch: batchesById.get(session.batch_id) ?? null,
            session,
          };
        })
        .filter((entry): entry is AttendanceEntry => Boolean(entry))
        .sort((first, second) =>
          second.session.session_date.localeCompare(first.session.session_date),
        );
    }
  }

  if (canViewFeeDetails) {
    const { data: feeRecordRows, error: feeRecordsError } = await supabase
      .from("fee_records")
      .select(
        "id, amount_due, amount_paid, due_date, status, notes, created_at",
      )
      .eq("institute_id", student.institute_id)
      .eq("branch_id", student.branch_id)
      .eq("student_id", student.id)
      .order("created_at", { ascending: false });

    queryError =
      logQueryError("student_fee_records", feeRecordsError) || queryError;

    const todayDate = getTodayDateValue();
    feeRecords = ((feeRecordRows ?? []) as FeeRecord[]).map((record) => {
      const amountDue = toAmount(record.amount_due);
      const amountPaid = toAmount(record.amount_paid);
      const computedStatus = getFeeStatus({
        amountDue,
        amountPaid,
        dueDate: record.due_date,
        status: record.status,
        todayDate,
      });

      return {
        ...record,
        amountDue,
        amountPaid,
        computedStatus,
        pendingAmount: Math.max(amountDue - amountPaid, 0),
      };
    });
  }

  // Fetch test scores for this student
  let testScores: Array<{
    id: string;
    marks_obtained: number | null;
    status: string;
    remarks: string | null;
    test_id: string;
    test: {
      title: string;
      subject: string | null;
      test_date: string;
      max_marks: number;
    } | null;
  }> = [];

  const { data: scoreRows, error: scoresError } = await supabase
    .from("test_scores")
    .select("id, marks_obtained, status, remarks, test_id, tests(title, subject, test_date, max_marks)")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  if (scoresError) {
    queryError = logQueryError("student_test_scores", scoresError) || queryError;
  } else {
    testScores = (scoreRows ?? []).map((row) => {
      const testRelation = row.tests as
        | Array<{
            max_marks: number | string;
            subject: string | null;
            test_date: string;
            title: string;
          }>
        | {
            max_marks: number | string;
            subject: string | null;
            test_date: string;
            title: string;
          }
        | null;
      const testData = Array.isArray(testRelation)
        ? testRelation[0] ?? null
        : testRelation;
      return {
        id: row.id,
        marks_obtained: row.marks_obtained !== null ? Number(row.marks_obtained) : null,
        status: row.status,
        remarks: row.remarks,
        test_id: row.test_id,
        test: testData ? {
          title: testData.title,
          subject: testData.subject,
          test_date: testData.test_date,
          max_marks: Number(testData.max_marks),
        } : null,
      };
    });
  }

  const presentTestScores = testScores.filter((s) => s.status === "present" && s.marks_obtained !== null && s.test);
  let averageTestPercentage = "-";
  if (presentTestScores.length > 0) {
    const percentages = presentTestScores.map((s) => (Number(s.marks_obtained!) / Number(s.test!.max_marks)) * 100);
    const sum = percentages.reduce((total, p) => total + p, 0);
    averageTestPercentage = `${Math.round(sum / presentTestScores.length)}%`;
  }

  const attendanceCounts = attendanceEntries.reduce<
    Record<AttendanceStatus, number>
  >(
    (counts, entry) => {
      counts[getAttendanceStatus(entry.status)] += 1;

      return counts;
    },
    {
      absent: 0,
      late: 0,
      present: 0,
    },
  );
  const attendancePercentage = getAttendancePercentage(
    attendanceCounts,
    attendanceEntries.length,
  );
  const feeTotals = feeRecords.reduce(
    (summary, record) => {
      summary.totalDue += record.amountDue;
      summary.totalPaid += record.amountPaid;
      summary.pendingAmount += record.pendingAmount;

      return summary;
    },
    {
      pendingAmount: 0,
      totalDue: 0,
      totalPaid: 0,
    },
  );
  const recentAttendance = attendanceEntries.slice(0, 8);
  const isTeacherWithoutAssignedBatches =
    role === "teacher" && canViewBatchDetails && assignedBatches.length === 0;

  if (isTeacherWithoutAssignedBatches) {
    return (
      <section className="grid gap-6">
        {getUnavailableProfileCard(
          "This student is not assigned to one of your batches.",
        )}
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/students">
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Back to students
            </Link>
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {student.full_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Student profile, batch assignments, attendance, and fee records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {student.archived_at ? (
            <Badge variant="outline">Archived</Badge>
          ) : null}
          <Badge
            variant={student.status === "inactive" ? "outline" : "secondary"}
          >
            {getStudentStatusLabel(student.status)}
          </Badge>
          <Badge variant="outline">{branch?.name ?? "Branch"}</Badge>
          {canReactivateStudent ? (
            <form action={reactivateStudent}>
              <input name="studentId" type="hidden" value={student.id} />
              <SubmitButton
                pendingLabel="Reactivating..."
                size="sm"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" data-icon="inline-start" />
                Reactivate
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {student.archived_at ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This student is archived. Attendance and fee history remain available
          for institute records.
        </div>
      ) : null}

      <ActionMessage
        error={
          queryError
            ? "Some student profile details are unavailable right now. Please try again."
            : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserRound aria-hidden="true" className="size-4" />
              Student status
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {student.archived_at
                ? "Archived"
                : getStudentStatusLabel(student.status)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {branch?.name ?? "Branch not available"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UsersRound aria-hidden="true" className="size-4" />
              Assigned batches
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {canViewBatchDetails ? assignedBatches.length : "-"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canViewBatchDetails
                ? "Visible for your role"
                : "Not available for your role"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarCheck aria-hidden="true" className="size-4" />
              Attendance
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {canViewAttendanceDetails ? attendancePercentage : "-"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canViewAttendanceDetails
                ? `${attendanceEntries.length} attendance records`
                : "Not available for your role"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Student information</CardTitle>
              <CardDescription>
                Contact details and current branch assignment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone aria-hidden="true" className="size-3.5" />
                  Student phone
                </p>
                <p className="mt-1 text-sm font-medium">
                  {student.phone ?? "Not added"}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone aria-hidden="true" className="size-3.5" />
                  Parent phone
                </p>
                <p className="mt-1 text-sm font-medium">
                  {student.parent_phone ?? "Not added"}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="mt-1 text-sm font-medium">
                  {branch?.name ?? "Branch not available"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Assigned batches</CardTitle>
              <CardDescription>
                Batches this student is enrolled in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewBatchDetails ? (
                assignedBatches.length ? (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {assignedBatches.map((batch) => (
                      <article
                        key={batch.id}
                        className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                      >
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-medium">
                            {batch.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">
                              {batch.subject ?? "Subject not specified"}
                            </span>
                            {batch.schedule ? (
                              <span className="whitespace-nowrap">
                                <span
                                  aria-hidden="true"
                                  className="hidden text-muted-foreground/60 sm:inline"
                                >
                                  |{" "}
                                </span>
                                {batch.schedule}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                        >
                          <Link href={getBatchProfileHref(batch)}>
                            View details
                          </Link>
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No batches assigned"
                    description="Assign this student to a batch to organize schedules and attendance."
                  />
                )
              ) : (
                <EmptyState
                  title="Batch information unavailable"
                  description="Batch information is not available for your role."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent attendance records</CardTitle>
              <CardDescription>
                Latest attendance entries for this student.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewAttendanceDetails ? (
                recentAttendance.length ? (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {recentAttendance.map((entry) => {
                      const status = getAttendanceStatus(entry.status);

                      return (
                        <article
                          key={entry.id}
                          className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                        >
                          <div className="min-w-0">
                            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                              <span className="whitespace-nowrap">
                                {formatDate(entry.session.session_date)}
                              </span>
                              <span className="break-words">
                                <span
                                  aria-hidden="true"
                                  className="hidden text-muted-foreground/60 sm:inline"
                                >
                                  |{" "}
                                </span>
                                {entry.batch?.name ?? "Batch not available"}
                              </span>
                            </h3>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {entry.session.notes ?? "No session note"}
                            </p>
                          </div>
                          <Badge variant={getAttendanceBadgeVariant(status)}>
                            {getAttendanceStatusLabel(status)}
                          </Badge>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No attendance records yet"
                    description="No attendance records have been recorded for this student yet."
                  />
                )
              ) : (
                <EmptyState
                  title="Attendance unavailable"
                  description="Attendance records are not available for your role."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Test Performance</CardTitle>
              <CardDescription>
                Recent test scores and overall average performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="rounded-md border border-border p-3 bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Average Test Percentage</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{averageTestPercentage}</p>
                  </div>
                  <Badge variant="secondary">
                    {presentTestScores.length} tests present
                  </Badge>
                </div>

                {testScores.length ? (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {testScores.map((score) => {
                      const scorePercentage =
                        score.status === "present" && score.marks_obtained !== null && score.test
                          ? (Number(score.marks_obtained) / Number(score.test.max_marks)) * 100
                          : null;

                      return (
                        <article
                          key={score.id}
                          className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                        >
                          <div className="min-w-0">
                            <h3 className="text-sm font-medium text-foreground">
                              {score.test?.title ?? "Test"}
                            </h3>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span>{score.test?.subject ?? "No subject"}</span>
                              {score.test?.test_date ? (
                                <>
                                  <span>&bull;</span>
                                  <span>{formatDate(score.test.test_date)}</span>
                                </>
                              ) : null}
                              {score.remarks ? (
                                <>
                                  <span>&bull;</span>
                                  <span className="italic text-foreground/80">&ldquo;{score.remarks}&rdquo;</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
                            <Badge
                              variant={
                                score.status === "present"
                                  ? "secondary"
                                  : score.status === "absent"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {score.status === "present" && score.marks_obtained !== null && score.test
                                ? `${score.marks_obtained} / ${score.test.max_marks} (${scorePercentage?.toFixed(0)}%)`
                                : score.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No test scores yet"
                    description="This student has not participated in any tests yet."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Attendance summary</CardTitle>
              <CardDescription>
                Summary across visible attendance records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewAttendanceDetails ? (
                <div className="grid gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Attendance percentage
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {attendancePercentage}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Badge variant="secondary">
                      Present {attendanceCounts.present}
                    </Badge>
                    <Badge variant="outline">Late {attendanceCounts.late}</Badge>
                    <Badge variant="destructive">
                      Absent {attendanceCounts.absent}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Late entries count toward the attendance percentage.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Attendance summary is not available for your role.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Financial summary</CardTitle>
              <CardDescription>
                Fee totals for this student.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewFeeDetails ? (
                <div className="grid gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total due</p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatCurrency(feeTotals.totalDue)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total paid</p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatCurrency(feeTotals.totalPaid)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Pending amount
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatCurrency(feeTotals.pendingAmount)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Fee records are not available for your role.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Fee records</CardTitle>
              <CardDescription>
                Payment status and balances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewFeeDetails ? (
                feeRecords.length ? (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {feeRecords.map((record) => (
                      <article key={record.id} className="grid gap-2 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="break-words text-sm font-medium">
                            Due {formatCurrency(record.amountDue)}
                          </h3>
                          <Badge
                            variant={getFeeBadgeVariant(record.computedStatus)}
                          >
                            {record.computedStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">
                            Paid {formatCurrency(record.amountPaid)}
                          </span>
                          <span className="whitespace-nowrap">
                            <span
                              aria-hidden="true"
                              className="hidden text-muted-foreground/60 sm:inline"
                            >
                              |{" "}
                            </span>
                            Pending {formatCurrency(record.pendingAmount)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">
                            Due date: {formatDate(record.due_date)}
                          </span>
                          {record.notes ? (
                            <span className="break-words">
                              <span
                                aria-hidden="true"
                                className="hidden text-muted-foreground/60 sm:inline"
                              >
                                |{" "}
                              </span>
                              {record.notes}
                            </span>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No fee records yet"
                    description="No fee records have been created for this student yet."
                  />
                )
              ) : (
                <EmptyState
                  title="Fee records unavailable"
                  description="Fee records are not available for your role."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

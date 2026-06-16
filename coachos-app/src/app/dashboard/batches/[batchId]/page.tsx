import {
  ArrowLeft,
  CalendarCheck,
  GraduationCap,
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
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/formatters/date";

export const metadata: Metadata = {
  title: "Batch Details",
};

type BatchDetailPageProps = {
  params: Promise<{
    batchId: string;
  }>;
};

type Batch = {
  branch_id: string;
  created_at: string | null;
  id: string;
  institute_id: string;
  name: string;
  schedule: string | null;
  subject: string | null;
};

type StudentBatch = {
  student_id: string;
};

type Student = {
  branch_id: string;
  full_name: string;
  id: string;
  phone: string | null;
  status: string | null;
};

type BatchTeacher = {
  id: string;
  membership_id: string;
};

type TeacherMembership = {
  branch_id: string | null;
  id: string;
  role: string | null;
  user_id: string;
};

type StaffTeacher = {
  auth_user_id: string | null;
  email: string;
  full_name: string;
};

type AttendanceSession = {
  id: string;
  locked_at: string | null;
  notes: string | null;
  session_date: string;
};

type AttendanceRecord = {
  session_id: string;
  status: string | null;
};

type AttendanceStatus = "present" | "absent" | "late";

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const attendanceStatusOrder = ["present", "absent", "late"] as const;

function getStatus(status: string | null): AttendanceStatus {
  if (status === "absent" || status === "late") {
    return status;
  }

  return "present";
}

function getStatusLabel(status: AttendanceStatus) {
  if (status === "absent") {
    return "Absent";
  }

  if (status === "late") {
    return "Late";
  }

  return "Present";
}

function getStatusBadgeVariant(
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

function getAttendancePercentage(
  counts: Record<AttendanceStatus, number>,
  totalRecords: number,
) {
  if (!totalRecords) {
    return "Not available";
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

function logBatchDetailQueryError(
  queryName: string,
  error: unknown,
  context: {
    batchId: string;
    instituteId: string;
    role: string | null;
    userId: string;
  },
) {
  if (!error) {
    return false;
  }

  console.error("Batch detail data load failed", {
    batchId: context.batchId,
    instituteId: context.instituteId,
    queryName,
    role: context.role,
    supabaseError: getSupabaseErrorDetails(error),
    userId: context.userId,
  });

  return true;
}

function getTeacherLabel(
  assignment: BatchTeacher,
  membershipsById: Map<string, TeacherMembership>,
  staffByAuthUserId: Map<string, StaffTeacher>,
) {
  const membership = membershipsById.get(assignment.membership_id);

  if (!membership) {
    return "Assigned teacher";
  }

  const staffTeacher = staffByAuthUserId.get(membership.user_id);

  if (!staffTeacher) {
    return "Linked teacher";
  }

  return staffTeacher.email
    ? `${staffTeacher.full_name} | ${staffTeacher.email}`
    : staffTeacher.full_name;
}

function getUnavailableBatchCard(message: string) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch details unavailable</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/dashboard/batches">
            <ArrowLeft aria-hidden="true" data-icon="inline-start" />
            Back to batches
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function BatchDetailPage({
  params,
}: BatchDetailPageProps) {
  const { batchId } = await params;
  const context = await requirePermission("batches.view");
  const { accessibleBranches, claims, institute, profile, role, supabase } =
    context;
  const logQueryError = (queryName: string, error: unknown) =>
    logBatchDetailQueryError(queryName, error, {
      batchId,
      instituteId: institute.id,
      role,
      userId: claims.sub,
    });

  const { data: batchRow, error: batchError } = await supabase
    .from("batches")
    .select(
      "id, institute_id, branch_id, name, subject, schedule, created_at",
    )
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  const hasBatchError = logQueryError("batch", batchError);
  const batch = batchRow as Batch | null;
  const branch = batch
    ? accessibleBranches.find(
        (accessibleBranch) => accessibleBranch.id === batch.branch_id,
      ) ?? null
    : null;

  return (
    <DashboardShell
      activePage="batches"
      instituteName={institute.name}
      role={role}
      title="Batch Details"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      {batch && branch ? (
        <BatchDetailContent
          batch={batch}
          branchName={branch.name}
          context={context}
          logQueryError={logQueryError}
        />
      ) : (
        <section className="grid gap-6">
          <ActionMessage
            error={
              hasBatchError
                ? "Batch information is unavailable right now. Please try again."
                : null
            }
          />
          {getUnavailableBatchCard(
            "This batch was not found or your account does not have access to it.",
          )}
        </section>
      )}
    </DashboardShell>
  );
}

async function BatchDetailContent({
  batch,
  branchName,
  context,
  logQueryError,
}: {
  batch: Batch;
  branchName: string;
  context: Awaited<ReturnType<typeof requirePermission>>;
  logQueryError: (queryName: string, error: unknown) => boolean;
}) {
  const { supabase } = context;
  const canViewAttendance = canAccessPermission(context, "attendance.view", {
    branchId: batch.branch_id,
  });
  let queryError = false;
  let students: Student[] = [];
  let teacherAssignments: BatchTeacher[] = [];
  let teacherMemberships: TeacherMembership[] = [];
  let staffTeachers: StaffTeacher[] = [];
  let attendanceSessions: AttendanceSession[] = [];
  let attendanceRecords: AttendanceRecord[] = [];

  const { data: studentBatchRows, error: studentBatchesError } = await supabase
    .from("student_batches")
    .select("student_id")
    .eq("batch_id", batch.id);

  queryError =
    logQueryError("student_batch_assignments", studentBatchesError) ||
    queryError;

  const studentIds = Array.from(
    new Set(
      ((studentBatchRows ?? []) as StudentBatch[])
        .map((studentBatch) => studentBatch.student_id)
        .filter(Boolean),
    ),
  );

  if (studentIds.length) {
    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, branch_id, full_name, phone, status")
      .eq("institute_id", batch.institute_id)
      .eq("branch_id", batch.branch_id)
      .in("id", studentIds)
      .order("full_name", { ascending: true });

    students = (studentRows ?? []) as Student[];
    queryError = logQueryError("assigned_students", studentsError) || queryError;
  }

  const { data: batchTeacherRows, error: batchTeachersError } = await supabase
    .from("batch_teachers")
    .select("id, membership_id")
    .eq("batch_id", batch.id)
    .order("created_at", { ascending: true });

  teacherAssignments = (batchTeacherRows ?? []) as BatchTeacher[];
  queryError =
    logQueryError("batch_teacher_assignments", batchTeachersError) ||
    queryError;

  const teacherMembershipIds = teacherAssignments.map(
    (assignment) => assignment.membership_id,
  );

  if (teacherMembershipIds.length) {
    const { data: teacherMembershipRows, error: teacherMembershipsError } =
      await supabase
        .from("memberships")
        .select("id, user_id, branch_id, role")
        .eq("institute_id", batch.institute_id)
        .eq("role", "teacher")
        .in("id", teacherMembershipIds);

    teacherMemberships = (teacherMembershipRows ?? []) as TeacherMembership[];
    queryError =
      logQueryError("teacher_memberships", teacherMembershipsError) ||
      queryError;

    const teacherUserIds = teacherMemberships.map(
      (membership) => membership.user_id,
    );

    if (teacherUserIds.length) {
      const { data: staffTeacherRows, error: staffTeachersError } =
        await supabase
          .from("staff_members")
          .select("auth_user_id, full_name, email")
          .eq("institute_id", batch.institute_id)
          .eq("role", "teacher")
          .in("auth_user_id", teacherUserIds);

      staffTeachers = (staffTeacherRows ?? []) as StaffTeacher[];
      queryError =
        logQueryError("teacher_staff_records", staffTeachersError) ||
        queryError;
    }
  }

  // Fetch tests for this batch
  let recentTests: Array<{
    id: string;
    title: string;
    subject: string | null;
    test_date: string;
    max_marks: number;
    status: string;
    entered_count: number;
    total_count: number;
    average_score: number | null;
  }> = [];

  const { data: testsData, error: testsError } = await supabase
    .from("tests")
    .select("id, title, subject, test_date, max_marks, status")
    .eq("batch_id", batch.id)
    .order("test_date", { ascending: false })
    .limit(6);

  if (testsError) {
    queryError = logQueryError("batch_recent_tests", testsError) || queryError;
  } else if (testsData && testsData.length > 0) {
    const testIds = testsData.map((t) => t.id);
    const { data: scoresData, error: scoresError } = await supabase
      .from("test_scores")
      .select("test_id, status, marks_obtained")
      .in("test_id", testIds);

    if (!scoresError && scoresData) {
      const statsMap = new Map<string, { entered: number; total: number; totalMarks: number; presentCount: number }>();
      for (const row of scoresData) {
        const stats = statsMap.get(row.test_id) ?? { entered: 0, total: 0, totalMarks: 0, presentCount: 0 };
        stats.total += 1;
        if (row.status !== "not_entered") {
          stats.entered += 1;
        }
        if (row.status === "present" && row.marks_obtained !== null) {
          stats.totalMarks += Number(row.marks_obtained);
          stats.presentCount += 1;
        }
        statsMap.set(row.test_id, stats);
      }

      recentTests = testsData.map((t) => {
        const stats = statsMap.get(t.id) ?? { entered: 0, total: 0, totalMarks: 0, presentCount: 0 };
        return {
          id: t.id,
          title: t.title,
          subject: t.subject,
          test_date: t.test_date,
          max_marks: Number(t.max_marks),
          status: t.status,
          entered_count: stats.entered,
          total_count: stats.total,
          average_score: stats.presentCount > 0 ? stats.totalMarks / stats.presentCount : null,
        };
      });
    } else {
      recentTests = testsData.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        test_date: t.test_date,
        max_marks: Number(t.max_marks),
        status: t.status,
        entered_count: 0,
        total_count: 0,
        average_score: null,
      }));
    }
  }

  if (canViewAttendance) {
    const { data: attendanceSessionRows, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, session_date, notes, locked_at")
      .eq("institute_id", batch.institute_id)
      .eq("branch_id", batch.branch_id)
      .eq("batch_id", batch.id)
      .order("session_date", { ascending: false })
      .limit(8);

    attendanceSessions = (attendanceSessionRows ?? []) as AttendanceSession[];
    queryError =
      logQueryError("recent_attendance_sessions", sessionsError) || queryError;

    const sessionIds = attendanceSessions.map((session) => session.id);

    if (sessionIds.length) {
      const { data: attendanceRecordRows, error: recordsError } = await supabase
        .from("attendance_records")
        .select("session_id, status")
        .in("session_id", sessionIds);

      attendanceRecords = (attendanceRecordRows ?? []) as AttendanceRecord[];
      queryError =
        logQueryError("recent_attendance_records", recordsError) || queryError;
    }
  }

  const membershipsById = new Map(
    teacherMemberships.map((membership) => [membership.id, membership]),
  );
  const staffByAuthUserId = new Map(
    staffTeachers
      .filter((staffTeacher) => staffTeacher.auth_user_id)
      .map((staffTeacher) => [staffTeacher.auth_user_id as string, staffTeacher]),
  );
  const recordsBySessionId = new Map<string, AttendanceRecord[]>();

  for (const record of attendanceRecords) {
    const records = recordsBySessionId.get(record.session_id) ?? [];
    records.push(record);
    recordsBySessionId.set(record.session_id, records);
  }

  const attendanceCounts = attendanceRecords.reduce<
    Record<AttendanceStatus, number>
  >(
    (counts, record) => {
      counts[getStatus(record.status)] += 1;

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
    attendanceRecords.length,
  );

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/batches">
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Back to batches
            </Link>
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {batch.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {batch.subject ?? "Subject not specified"}
            {batch.schedule ? ` | ${batch.schedule}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant="secondary">{students.length} students</Badge>
          <Badge variant="outline">{teacherAssignments.length} teachers</Badge>
          <Badge variant="outline">{branchName}</Badge>
        </div>
      </div>

      <ActionMessage
        error={
          queryError
            ? "Some batch details are unavailable right now. Please try again."
            : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GraduationCap aria-hidden="true" className="size-4" />
              Subject
            </p>
            <p className="mt-2 text-xl font-semibold">
              {batch.subject ?? "Not specified"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarCheck aria-hidden="true" className="size-4" />
              Schedule
            </p>
            <p className="mt-2 text-xl font-semibold">
              {batch.schedule ?? "Not specified"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UsersRound aria-hidden="true" className="size-4" />
              Assigned students
            </p>
            <p className="mt-2 text-2xl font-semibold">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarCheck aria-hidden="true" className="size-4" />
              Attendance
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {canViewAttendance ? attendancePercentage : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Assigned students</CardTitle>
              <CardDescription>
                Students currently enrolled in this batch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {students.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {students.map((student) => (
                    <article
                      key={student.id}
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium">
                          {student.full_name}
                        </h3>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {student.phone ?? "Phone not added"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
                        <Badge
                          variant={
                            student.status === "inactive"
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {student.status === "inactive" ? "Inactive" : "Active"}
                        </Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/students/${student.id}`}>
                            View profile
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No students assigned"
                  description="Assign students to this batch to organize schedules and attendance."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Recent attendance sessions
              </CardTitle>
              <CardDescription>
                Latest submitted attendance records for this batch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewAttendance ? (
                attendanceSessions.length ? (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {attendanceSessions.map((session) => {
                      const records = recordsBySessionId.get(session.id) ?? [];
                      const sessionCounts = records.reduce<
                        Record<AttendanceStatus, number>
                      >(
                        (counts, record) => {
                          counts[getStatus(record.status)] += 1;

                          return counts;
                        },
                        {
                          absent: 0,
                          late: 0,
                          present: 0,
                        },
                      );

                      return (
                        <article
                          key={session.id}
                          className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                        >
                          <div className="min-w-0">
                            <h3 className="text-sm font-medium">
                              {formatDate(session.session_date)}
                            </h3>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {session.notes ?? "No session note"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
                            <Badge
                              variant={session.locked_at ? "secondary" : "outline"}
                            >
                              {session.locked_at ? "Locked" : "Editable"}
                            </Badge>
                            {attendanceStatusOrder.map((status) => (
                              <Badge
                                key={status}
                                variant={getStatusBadgeVariant(status)}
                              >
                                {getStatusLabel(status)} {sessionCounts[status]}
                              </Badge>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No attendance records yet"
                    description="No attendance records have been submitted for this batch yet."
                  />
                )
              ) : (
                <EmptyState
                  title="Attendance unavailable"
                  description="Attendance details are not available for your role."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Tests & Exams</CardTitle>
              <CardDescription>
                Recent test performances and entry progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentTests.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {recentTests.map((test) => (
                    <article
                      key={test.id}
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium">
                          <Link href={`/dashboard/tests/${test.id}`} className="hover:underline text-foreground">
                            {test.title}
                          </Link>
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">
                            Date: {formatDate(test.test_date)}
                          </span>
                          <span>&bull;</span>
                          <span className="whitespace-nowrap">
                            Max {test.max_marks} marks
                          </span>
                          <span>&bull;</span>
                          <span className="whitespace-nowrap">
                            Progress: {test.entered_count} / {test.total_count} entered
                          </span>
                          {test.average_score !== null ? (
                            <>
                              <span>&bull;</span>
                              <span className="whitespace-nowrap font-medium text-foreground">
                                Avg: {test.average_score.toFixed(1)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
                        <Badge
                          variant={
                            test.status === "completed"
                              ? "secondary"
                              : test.status === "marks_entry"
                                ? "default"
                                : "outline"
                          }
                        >
                          {test.status.replace("_", " ")}
                        </Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/tests/${test.id}`}>
                            View scores
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No tests created yet"
                  description="No tests have been scheduled for this batch yet."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Assigned teachers</CardTitle>
              <CardDescription>
                Teacher staff members linked to this batch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teacherAssignments.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {teacherAssignments.map((assignment) => (
                    <article key={assignment.id} className="grid gap-1 p-4">
                      <h3 className="text-sm font-medium">
                        {getTeacherLabel(
                          assignment,
                          membershipsById,
                          staffByAuthUserId,
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Assigned teacher
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No teachers assigned"
                  description="No teacher staff members are assigned to this batch yet."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Attendance summary</CardTitle>
              <CardDescription>
                Based on recent visible attendance records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canViewAttendance ? (
                <div className="grid gap-3">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      Attendance percentage
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {attendancePercentage}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
    </section>
  );
}

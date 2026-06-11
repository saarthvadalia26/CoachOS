import {
  CalendarCheck,
  Eye,
  Save,
  Search,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
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
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";
import {
  reopenAttendanceSession,
  saveTodayAttendance,
} from "@/lib/attendance/actions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  formatDate,
  formatDateRange,
  formatTimestamp,
} from "@/lib/formatters/date";

type AttendancePageProps = {
  searchParams: Promise<{
    academicYearId?: string;
    branchId?: string;
    batchId?: string;
    endDate?: string;
    error?: string;
    audit?: string;
    historyBatchId?: string;
    sessionId?: string;
    sessionDate?: string;
    startDate?: string;
    studentId?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Attendance",
};

type Batch = {
  branch_id: string;
  id: string;
  name: string;
  subject: string | null;
  schedule: string | null;
};

type Student = {
  id: string;
  full_name: string;
  phone: string | null;
};

type AttendanceSession = {
  batch_id: string;
  branch_id: string;
  id: string;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
  reopen_count: number;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  session_date: string;
};

type AttendanceRecord = {
  id?: string;
  session_id?: string;
  student_id: string;
  status: string;
};

type AcademicYear = {
  end_date: string;
  id: string;
  is_active: boolean | null;
  name: string;
  start_date: string;
};

type HistorySession = {
  academic_year_id: string | null;
  batch_id: string;
  branch_id: string;
  id: string;
  locked_at: string | null;
  notes: string | null;
  reopen_count: number;
  reopened_at: string | null;
  reopen_reason: string | null;
  session_date: string;
};

type AttendanceAuditLog = {
  action: string;
  changed_by: string | null;
  created_at: string;
  id: string;
  new_status: string | null;
  old_status: string | null;
  reason: string | null;
  student_id: string | null;
};

type StudentLookup = Student & {
  branch_id?: string | null;
};

type AttendancePageQueryLogContext = {
  batchId?: string | null;
  branchId?: string | null;
  instituteId: string;
  queryName: string;
  role: string | null;
  userId: string;
};

type SupabaseErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

const statusOptions = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
  { label: "Late", value: "late" },
] as const;

type AttendanceStatus = (typeof statusOptions)[number]["value"];

function getStatusForStudent(
  recordsByStudentId: Map<string, string>,
  studentId: string,
) {
  const status = recordsByStudentId.get(studentId);

  if (status === "present" || status === "absent" || status === "late") {
    return status;
  }

  return "present";
}

function getStatusCounts(
  students: Student[],
  recordsByStudentId: Map<string, string>,
) {
  return students.reduce<Record<AttendanceStatus, number>>(
    (counts, student) => {
      const status = getStatusForStudent(recordsByStudentId, student.id);
      counts[status] += 1;

      return counts;
    },
    {
      absent: 0,
      late: 0,
      present: 0,
    },
  );
}

function getRecordStatus(status: string | null | undefined): AttendanceStatus {
  if (status === "present" || status === "absent" || status === "late") {
    return status;
  }

  return "present";
}

function getRecordStatusCounts(records: Array<{ status: string | null }>) {
  return records.reduce<Record<AttendanceStatus, number>>(
    (counts, record) => {
      counts[getRecordStatus(record.status)] += 1;

      return counts;
    },
    {
      absent: 0,
      late: 0,
      present: 0,
    },
  );
}

function getAttendancePercentage(
  counts: Record<AttendanceStatus, number>,
  totalSessions: number,
) {
  if (!totalSessions) {
    return "0%";
  }

  return `${Math.round(((counts.present + counts.late) / totalSessions) * 100)}%`;
}

function isDateValue(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getMonthStartDate(dateValue: string) {
  return `${dateValue.slice(0, 8)}01`;
}

function getAttendanceHref(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const queryString = search.toString();

  return queryString ? `/dashboard/attendance?${queryString}` : "/dashboard/attendance";
}

function getAttendanceExportHref(
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const queryString = search.toString();

  return queryString
    ? `/dashboard/attendance/export?${queryString}`
    : "/dashboard/attendance/export";
}

function getStatusPillClass(isSelected: boolean) {
  return isSelected
    ? "flex h-9 items-center justify-center rounded-md border border-primary bg-primary px-2 text-xs font-medium text-primary-foreground"
    : "flex h-9 items-center justify-center rounded-md border border-border bg-muted/30 px-2 text-xs font-medium text-muted-foreground";
}

function getSessionStatusLabel(
  session: Pick<
    AttendanceSession | HistorySession,
    "locked_at" | "reopened_at"
  > | null,
) {
  if (!session) {
    return "Ready for attendance";
  }

  if (session.locked_at) {
    return "Locked";
  }

  if (session.reopened_at) {
    return "Reopened";
  }

  return "Editable";
}

function getSessionStatusVariant(
  session: Pick<
    AttendanceSession | HistorySession,
    "locked_at" | "reopened_at"
  > | null,
): "outline" | "secondary" {
  if (!session) {
    return "outline";
  }

  return session.locked_at ? "secondary" : "outline";
}

function getAuditActionLabel(action: string) {
  if (action === "session_created") {
    return "Attendance submitted";
  }

  if (action === "session_locked") {
    return "Attendance locked";
  }

  if (action === "session_reopened") {
    return "Attendance reopened";
  }

  if (action === "status_changed") {
    return "Status updated";
  }

  if (action === "notes_changed") {
    return "Session note updated";
  }

  return action;
}

function getActorLabel(changedBy: string | null, currentUserId: string) {
  if (!changedBy) {
    return "System";
  }

  if (changedBy === currentUserId) {
    return "You";
  }

  return "Team member";
}

function getStatusLabel(status: string | null) {
  if (status === "present") {
    return "Present";
  }

  if (status === "absent") {
    return "Absent";
  }

  if (status === "late") {
    return "Late";
  }

  return "Not recorded";
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

function logAttendancePageQueryError(
  error: unknown,
  context: AttendancePageQueryLogContext,
) {
  console.error("Attendance page data load failed", {
    batchId: context.batchId ?? null,
    branchId: context.branchId ?? null,
    instituteId: context.instituteId,
    queryName: context.queryName,
    role: context.role,
    supabaseError: getSupabaseErrorDetails(error),
    userId: context.userId,
  });
}

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  const context = await requirePermission("attendance.view");
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const todayDate = getTodayDateValue();
  const activeSessionDate = isDateValue(params.sessionDate)
    ? params.sessionDate!
    : todayDate;

  let batchesQuery = supabase
    .from("batches")
    .select("id, branch_id, name, subject, schedule")
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });

  if (branchScope.selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  const { data: batchRows, error: batchesError } = await batchesQuery;

  const batches = (batchRows ?? []) as Batch[];
  const selectedBatch =
    batches.find((batch) => batch.id === params.batchId) ?? batches[0] ?? null;
  const selectedBatchId = selectedBatch?.id;
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));

  const { data: academicYearRows, error: academicYearsError } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_active")
    .eq("institute_id", institute.id)
    .order("start_date", { ascending: false });

  const academicYears = (academicYearRows ?? []) as AcademicYear[];
  const selectedAcademicYear =
    academicYears.find((year) => year.id === params.academicYearId) ?? null;
  const selectedAcademicYearId = selectedAcademicYear?.id ?? "";
  const selectedHistoryBatch =
    batches.find((batch) => batch.id === params.historyBatchId) ?? null;
  const selectedHistoryBatchId = selectedHistoryBatch?.id ?? "";
  const historyStartDate = isDateValue(params.startDate)
    ? params.startDate!
    : selectedAcademicYear?.start_date ?? getMonthStartDate(todayDate);
  const historyEndDate = isDateValue(params.endDate)
    ? params.endDate!
    : selectedAcademicYear?.end_date ?? todayDate;

  let students: Student[] = [];
  let attendanceSession: AttendanceSession | null = null;
  let attendanceRecords: AttendanceRecord[] = [];
  let queryError = false;
  const logQueryError = (
    queryName: string,
    error: unknown,
    values?: {
      batchId?: string | null;
      branchId?: string | null;
    },
  ) => {
    if (!error) {
      return false;
    }

    logAttendancePageQueryError(error, {
      batchId: values?.batchId ?? selectedBatchId ?? params.batchId ?? null,
      branchId:
        values?.branchId ??
        selectedBatch?.branch_id ??
        branchScope.selectedBranchId ??
        context.branchId ??
        null,
      instituteId: institute.id,
      queryName,
      role,
      userId: claims.sub,
    });

    return true;
  };

  queryError = logQueryError("batches", batchesError) || queryError;
  queryError =
    logQueryError("academic_years", academicYearsError) || queryError;

  if (selectedBatchId) {
    const { data: studentBatchRows, error: studentBatchesError } =
      await supabase
        .from("student_batches")
        .select("student_id")
        .eq("batch_id", selectedBatchId);

    queryError =
      logQueryError("student_batches_current_batch", studentBatchesError, {
        batchId: selectedBatchId,
        branchId: selectedBatch.branch_id,
      }) || queryError;

    const studentIds = (studentBatchRows ?? [])
      .map((studentBatch) => studentBatch.student_id)
      .filter(Boolean);

    if (studentIds.length) {
      const { data: studentRows, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, phone")
        .eq("institute_id", institute.id)
        .eq("branch_id", selectedBatch.branch_id)
        .in("id", studentIds)
        .order("full_name", { ascending: true });

      students = (studentRows ?? []) as Student[];
      queryError =
        logQueryError("students_current_batch", studentsError, {
          batchId: selectedBatchId,
          branchId: selectedBatch.branch_id,
        }) || queryError;
    }

    const { data: sessionRow, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select(
        "id, branch_id, batch_id, session_date, notes, locked_at, locked_by, reopen_count, reopened_at, reopened_by, reopen_reason",
      )
      .eq("institute_id", institute.id)
      .eq("branch_id", selectedBatch.branch_id)
      .eq("batch_id", selectedBatchId)
      .eq("session_date", activeSessionDate)
      .maybeSingle();

    attendanceSession = sessionRow as AttendanceSession | null;
    queryError =
      logQueryError("attendance_session_current_record", sessionError, {
        batchId: selectedBatchId,
        branchId: selectedBatch.branch_id,
      }) || queryError;

    if (attendanceSession) {
      const { data: recordRows, error: recordsError } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("session_id", attendanceSession.id);

      attendanceRecords = (recordRows ?? []) as AttendanceRecord[];
      queryError =
        logQueryError("attendance_records_current_record", recordsError, {
          batchId: selectedBatchId,
          branchId: selectedBatch.branch_id,
        }) || queryError;
    }
  }

  const historyBatchIds = selectedHistoryBatchId
    ? [selectedHistoryBatchId]
    : batches.map((batch) => batch.id);
  let historyStudents: StudentLookup[] = [];

  if (historyBatchIds.length) {
    const { data: historyStudentBatchRows, error: historyStudentBatchesError } =
      await supabase
        .from("student_batches")
        .select("student_id")
        .in("batch_id", historyBatchIds);

    queryError =
      logQueryError(
        "student_batches_history",
        historyStudentBatchesError,
        {
          batchId: selectedHistoryBatchId || selectedBatchId,
          branchId: selectedHistoryBatch?.branch_id ?? selectedBatch?.branch_id,
        },
      ) || queryError;

    const historyStudentIds = Array.from(
      new Set(
        (historyStudentBatchRows ?? [])
          .map((studentBatch) => studentBatch.student_id)
          .filter(Boolean),
      ),
    );

    if (historyStudentIds.length) {
      const { data: historyStudentRows, error: historyStudentsError } =
        await supabase
          .from("students")
          .select("id, full_name, phone, branch_id")
          .eq("institute_id", institute.id)
          .in("id", historyStudentIds)
          .order("full_name", { ascending: true });

      historyStudents = (historyStudentRows ?? []) as StudentLookup[];
      queryError =
        logQueryError("students_history", historyStudentsError, {
          batchId: selectedHistoryBatchId || selectedBatchId,
          branchId: selectedHistoryBatch?.branch_id ?? selectedBatch?.branch_id,
        }) || queryError;
    }
  }

  const selectedStudent =
    historyStudents.find((student) => student.id === params.studentId) ?? null;
  const selectedStudentId = selectedStudent?.id ?? "";
  let historySessions: HistorySession[] = [];

  if (historyBatchIds.length) {
    let historySessionsQuery = supabase
      .from("attendance_sessions")
      .select(
        "id, institute_id, branch_id, batch_id, academic_year_id, session_date, notes, locked_at, reopen_count, reopened_at, reopen_reason",
      )
      .eq("institute_id", institute.id)
      .gte("session_date", historyStartDate)
      .lte("session_date", historyEndDate)
      .in("batch_id", historyBatchIds);

    if (selectedAcademicYearId) {
      historySessionsQuery = historySessionsQuery.eq(
        "academic_year_id",
        selectedAcademicYearId,
      );
    }

    if (branchScope.selectedBranchId) {
      historySessionsQuery = historySessionsQuery.eq(
        "branch_id",
        branchScope.selectedBranchId,
      );
    } else if (branchScope.visibleBranchIds.length) {
      historySessionsQuery = historySessionsQuery.in(
        "branch_id",
        branchScope.visibleBranchIds,
      );
    }

    const { data: historySessionRows, error: historySessionsError } =
      await historySessionsQuery
        .order("session_date", { ascending: false })
        .limit(100);

    historySessions = (historySessionRows ?? []) as HistorySession[];
    queryError =
      logQueryError("attendance_sessions_history", historySessionsError, {
        batchId: selectedHistoryBatchId || selectedBatchId,
        branchId: selectedHistoryBatch?.branch_id ?? selectedBatch?.branch_id,
      }) || queryError;
  }

  const historySessionIds = historySessions.map((session) => session.id);
  let historyRecords: AttendanceRecord[] = [];

  if (historySessionIds.length) {
    const { data: historyRecordRows, error: historyRecordsError } =
      await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status")
        .in("session_id", historySessionIds);

    historyRecords = (historyRecordRows ?? []) as AttendanceRecord[];
    queryError =
      logQueryError("attendance_records_history", historyRecordsError, {
        batchId: selectedHistoryBatchId || selectedBatchId,
        branchId: selectedHistoryBatch?.branch_id ?? selectedBatch?.branch_id,
      }) || queryError;
  }

  const historyRecordsBySessionId = new Map<string, AttendanceRecord[]>();

  for (const record of historyRecords) {
    if (!record.session_id) {
      continue;
    }

    const sessionRecords = historyRecordsBySessionId.get(record.session_id) ?? [];
    sessionRecords.push(record);
    historyRecordsBySessionId.set(record.session_id, sessionRecords);
  }

  const filteredHistorySessions = selectedStudentId
    ? historySessions.filter((session) =>
        (historyRecordsBySessionId.get(session.id) ?? []).some(
          (record) => record.student_id === selectedStudentId,
        ),
      )
    : historySessions;
  const filteredHistorySessionIds = new Set(
    filteredHistorySessions.map((session) => session.id),
  );
  const selectedStudentRecords = selectedStudentId
    ? historyRecords.filter(
        (record) =>
          record.student_id === selectedStudentId &&
          record.session_id &&
          filteredHistorySessionIds.has(record.session_id),
      )
    : [];
  const selectedStudentCounts = getRecordStatusCounts(selectedStudentRecords);
  const selectedStudentTotalSessions = selectedStudentRecords.length;
  const selectedStudentAttendancePercentage = getAttendancePercentage(
    selectedStudentCounts,
    selectedStudentTotalSessions,
  );
  const selectedHistorySession =
    filteredHistorySessions.find((session) => session.id === params.sessionId) ??
    null;
  const selectedHistorySessionRecords = selectedHistorySession
    ? historyRecordsBySessionId.get(selectedHistorySession.id) ?? []
    : [];
  const historyStudentsById = new Map(
    historyStudents.map((student) => [student.id, student]),
  );
  const currentStudentsById = new Map(
    students.map((student) => [student.id, student]),
  );
  const auditStudentsById = new Map([
    ...historyStudentsById,
    ...currentStudentsById,
  ]);

  const recordsByStudentId = new Map(
    attendanceRecords.map((record) => [record.student_id, record.status]),
  );
  const statusCounts = getStatusCounts(students, recordsByStudentId);
  const selectedBatchScope = selectedBatch
    ? { branchId: selectedBatch.branch_id }
    : undefined;
  const canCreateAttendance = selectedBatchScope
    ? canAccessPermission(context, "attendance.create", selectedBatchScope)
    : false;
  const canUpdateAttendance = selectedBatchScope
    ? canAccessPermission(context, "attendance.update", selectedBatchScope)
    : false;
  const isAttendanceLocked = Boolean(attendanceSession?.locked_at);
  const canEditAttendance = attendanceSession
    ? canUpdateAttendance && !isAttendanceLocked
    : canCreateAttendance;
  const canOwnerReopenAttendance = Boolean(
    attendanceSession?.locked_at &&
      selectedBatchScope &&
      canUpdateAttendance &&
      context.memberships.some((membership) => {
        return membership.role === "owner";
      }),
  );
  const canBranchManagerReopenAttendance = Boolean(
    attendanceSession?.locked_at &&
      selectedBatchScope &&
      canUpdateAttendance &&
      context.memberships.some((membership) => {
        return (
          membership.role === "branch_manager" &&
          membership.branch_id === selectedBatchScope.branchId
        );
      }),
  );
  const attendanceReopenCount = attendanceSession?.reopen_count ?? 0;
  const isReopenLimitReached =
    canBranchManagerReopenAttendance &&
    !canOwnerReopenAttendance &&
    attendanceReopenCount >= 2;
  const canReopenAttendance =
    canOwnerReopenAttendance ||
    (canBranchManagerReopenAttendance && attendanceReopenCount < 2);
  const academicYearsById = new Map(
    academicYears.map((academicYear) => [academicYear.id, academicYear]),
  );
  const resetHistoryHref = getAttendanceHref({
    branchId: branchScope.selectedBranchId,
  });
  const exportHistoryHref = getAttendanceExportHref({
    academicYearId: selectedAcademicYearId,
    branchId: branchScope.selectedBranchId,
    endDate: historyEndDate,
    historyBatchId: selectedHistoryBatchId,
    startDate: historyStartDate,
    studentId: selectedStudentId,
  });
  const selectedAuditSession = selectedHistorySession ?? attendanceSession;
  const isAuditExpanded = params.audit === "full";
  const canViewAuditHistory = Boolean(
    selectedAuditSession &&
      selectedAuditSession.branch_id &&
      ["owner", "branch_manager", "operations_staff"].includes(role) &&
      canAccessPermission(context, "attendance.view", {
        branchId: selectedAuditSession.branch_id,
      }),
  );
  let auditLogs: AttendanceAuditLog[] = [];

  if (selectedAuditSession && canViewAuditHistory) {
    const { data: auditLogRows, error: auditLogsError } = await supabase
      .from("attendance_audit_logs")
      .select(
        "id, action, student_id, changed_by, old_status, new_status, reason, created_at",
      )
      .eq("session_id", selectedAuditSession.id)
      .order("created_at", { ascending: false })
      .limit(50);

    auditLogs = (auditLogRows ?? []) as AttendanceAuditLog[];
    queryError =
      logQueryError("attendance_audit_logs", auditLogsError, {
        batchId: selectedAuditSession.batch_id,
        branchId: selectedAuditSession.branch_id,
      }) || queryError;
  }
  const visibleAuditLogs = isAuditExpanded ? auditLogs : auditLogs.slice(0, 2);
  const auditToggleHref = getAttendanceHref({
    academicYearId: selectedAcademicYearId,
    audit: isAuditExpanded ? null : "full",
    batchId: selectedBatchId,
    branchId: branchScope.selectedBranchId,
    endDate: historyEndDate,
    historyBatchId: selectedHistoryBatchId,
    sessionDate: activeSessionDate,
    sessionId: selectedHistorySession?.id,
    startDate: historyStartDate,
    studentId: selectedStudentId,
  });

  return (
    <DashboardShell
      activePage="attendance"
      instituteName={institute.name}
      role={role}
      title="Attendance"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        {branchScope.showOwnerBranchFilter ? (
          <BranchFilter
            branches={accessibleBranches}
            selectedBranchId={branchScope.selectedBranchId}
          />
        ) : null}

        <Card>
          <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <CardTitle className="text-xl">
                {activeSessionDate === todayDate
                  ? "Today's attendance"
                  : "Attendance record"}
              </CardTitle>
              <CardDescription>
                {formatDate(activeSessionDate)}
                {selectedBatch ? ` | ${selectedBatch.name}` : ""}
              </CardDescription>
            </div>
            <Badge variant={getSessionStatusVariant(attendanceSession)}>
              {attendanceSession
                ? getSessionStatusLabel(attendanceSession)
                : canEditAttendance
                  ? "Ready to submit"
                  : "No attendance record"}
            </Badge>
          </CardHeader>
          <CardContent>
            <ActionMessage
              className="mb-4"
              error={
                params.error ??
                (queryError
                  ? "Attendance records are unavailable right now. Please try again."
                  : null)
              }
              success={params.success}
            />

            <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
              {branchScope.selectedBranchId ? (
                <input
                  name="branchId"
                  type="hidden"
                  value={branchScope.selectedBranchId}
                />
              ) : null}
              {activeSessionDate !== todayDate ? (
                <input
                  name="sessionDate"
                  type="hidden"
                  value={activeSessionDate}
                />
              ) : null}
              <Label>
                Batch
                <select
                  name="batchId"
                  defaultValue={selectedBatchId ?? ""}
                  disabled={!batches.length}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {batches.length ? null : (
                    <option value="">No batches available</option>
                  )}
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                      {batch.subject ? ` - ${batch.subject}` : ""}
                    </option>
                  ))}
                </select>
              </Label>
              <SubmitButton
                variant="outline"
                className="self-end"
                disabled={!batches.length}
                pendingLabel="Loading..."
              >
                <CalendarCheck aria-hidden="true" data-icon="inline-start" />
                View batch
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        {!batches.length ? (
          <Card>
            <CardContent className="pt-5">
              <EmptyState
                actionHref="/dashboard/batches"
                actionLabel="View batches"
                title="No batches available"
                description="No batches match your current branch access. Create or select a batch before recording attendance."
              />
            </CardContent>
          </Card>
        ) : null}

        {selectedBatch && !students.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{selectedBatch.name}</CardTitle>
              <CardDescription>
                {canEditAttendance
                  ? "Add students to this batch before saving attendance."
                  : "No students are assigned to this batch yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                actionHref="/dashboard/batches"
                actionLabel={
                  canEditAttendance ? "Manage batch students" : "View batches"
                }
                title="No students assigned"
                description={
                  canEditAttendance
                    ? "Assign students to this batch before saving attendance."
                    : "No students are assigned to this batch yet."
                }
              />
            </CardContent>
          </Card>
        ) : null}

        {selectedBatch && students.length ? (
          <Card>
            <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <CardTitle className="text-lg">{selectedBatch.name}</CardTitle>
                <CardDescription>
                  {selectedBatch.subject ?? "Subject not specified"}
                  {selectedBatch.schedule ? ` | ${selectedBatch.schedule}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getSessionStatusVariant(attendanceSession)}>
                  {getSessionStatusLabel(attendanceSession)}
                </Badge>
                <Badge variant="secondary">Present {statusCounts.present}</Badge>
                <Badge variant="outline">Absent {statusCounts.absent}</Badge>
                <Badge variant="outline">Late {statusCounts.late}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {canEditAttendance ? (
                <form action={saveTodayAttendance} className="grid gap-5">
                  <input type="hidden" name="batchId" value={selectedBatch.id} />
                  <input
                    type="hidden"
                    name="sessionDate"
                    value={activeSessionDate}
                  />
                  <Label>
                    Attendance note
                    <Input
                      name="notes"
                      type="text"
                      defaultValue={attendanceSession?.notes ?? ""}
                      placeholder="Optional attendance note"
                    />
                  </Label>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {students.map((student) => {
                      const currentStatus = getStatusForStudent(
                        recordsByStudentId,
                        student.id,
                      );

                      return (
                        <article
                          key={student.id}
                          className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                        >
                          <div>
                            <h3 className="text-sm font-medium">
                              {student.full_name}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {student.phone ?? "Phone not added"}
                            </p>
                          </div>
                          <fieldset>
                            <legend className="sr-only">
                              Attendance status for {student.full_name}
                            </legend>
                            <div className="grid w-full grid-cols-3 gap-2 lg:w-[300px]">
                              {statusOptions.map((option) => {
                                const inputId = `${student.id}-${option.value}`;
                                const isSelected =
                                  currentStatus === option.value;

                                return (
                                  <label
                                    key={option.value}
                                    htmlFor={inputId}
                                    className="cursor-pointer"
                                  >
                                    <input
                                      id={inputId}
                                      className="peer sr-only"
                                      type="radio"
                                      name={`status-${student.id}`}
                                      value={option.value}
                                      defaultChecked={isSelected}
                                    />
                                    <span className="flex h-9 items-center justify-center rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                                      {option.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        </article>
                      );
                    })}
                  </div>
                  <SubmitButton
                    className="justify-self-start"
                    pendingLabel="Saving..."
                  >
                    <Save aria-hidden="true" data-icon="inline-start" />
                    Submit attendance
                  </SubmitButton>
                </form>
              ) : (
                <div className="grid gap-5">
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
                    <p className="text-sm font-medium">Attendance note</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {attendanceSession?.notes ?? "No attendance note added"}
                    </p>
                  </div>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {students.map((student) => {
                      const currentStatus = getStatusForStudent(
                        recordsByStudentId,
                        student.id,
                      );

                      return (
                        <article
                          key={student.id}
                          className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                        >
                          <div>
                            <h3 className="text-sm font-medium">
                              {student.full_name}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {student.phone ?? "Phone not added"}
                            </p>
                          </div>
                          <div className="grid w-full grid-cols-3 gap-2 lg:w-[300px]">
                            {statusOptions.map((option) => {
                              const isSelected =
                                currentStatus === option.value;

                              return (
                                <span
                                  key={option.value}
                                  aria-current={isSelected ? "true" : undefined}
                                  className={getStatusPillClass(isSelected)}
                                >
                                  {option.label}
                                </span>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {canReopenAttendance && attendanceSession ? (
                    <form
                      action={reopenAttendanceSession}
                      className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_auto] sm:items-end"
                    >
                      <input
                        type="hidden"
                        name="sessionId"
                        value={attendanceSession.id}
                      />
                      <input
                        type="hidden"
                        name="batchId"
                        value={selectedBatch.id}
                      />
                      <Label>
                        Reopen reason
                        <Input
                          name="reopenReason"
                          placeholder="Describe why this attendance record needs correction"
                          required
                        />
                      </Label>
                      <SubmitButton
                        pendingLabel="Updating..."
                        variant="outline"
                      >
                        <Unlock aria-hidden="true" data-icon="inline-start" />
                        Reopen attendance
                      </SubmitButton>
                    </form>
                  ) : null}
                  {isReopenLimitReached ? (
                    <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      This attendance record has reached the reopen limit.
                      Please contact the institute owner for further changes.
                    </p>
                  ) : null}
                  {attendanceSession?.locked_at &&
                  (canBranchManagerReopenAttendance ||
                    (canOwnerReopenAttendance && attendanceReopenCount > 0)) ? (
                    <p className="text-xs text-muted-foreground">
                      {canOwnerReopenAttendance &&
                      !canBranchManagerReopenAttendance
                        ? `Reopened ${attendanceReopenCount} ${
                            attendanceReopenCount === 1 ? "time" : "times"
                          }.`
                        : `Reopened ${Math.min(attendanceReopenCount, 2)} of 2 times.`}
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Attendance history</CardTitle>
            <CardDescription>
              {formatDateRange(historyStartDate, historyEndDate)}
              {selectedAcademicYear ? ` | ${selectedAcademicYear.name}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form className="grid gap-3">
              {branchScope.selectedBranchId ? (
                <input
                  name="branchId"
                  type="hidden"
                  value={branchScope.selectedBranchId}
                />
              ) : null}
              {selectedBatchId ? (
                <input name="batchId" type="hidden" value={selectedBatchId} />
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Label>
                  Academic year
                  <select
                    name="academicYearId"
                    defaultValue={selectedAcademicYearId}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Any year</option>
                    {academicYears.map((academicYear) => (
                      <option key={academicYear.id} value={academicYear.id}>
                        {academicYear.name}
                        {academicYear.is_active ? " - Active" : ""}
                      </option>
                    ))}
                  </select>
                </Label>

                <Label>
                  Batch
                  <select
                    name="historyBatchId"
                    defaultValue={selectedHistoryBatchId}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All batches</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                        {batch.subject ? ` - ${batch.subject}` : ""}
                      </option>
                    ))}
                  </select>
                </Label>

                <Label>
                  Student
                  <select
                    name="studentId"
                    defaultValue={selectedStudentId}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All students</option>
                    {historyStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </Label>

                <Label>
                  From
                  <Input
                    name="startDate"
                    type="date"
                    defaultValue={
                      isDateValue(params.startDate) ? params.startDate : ""
                    }
                  />
                </Label>

                <Label>
                  To
                  <Input
                    name="endDate"
                    type="date"
                    defaultValue={
                      isDateValue(params.endDate) ? params.endDate : ""
                    }
                  />
                </Label>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <ExportButton
                  className="w-full sm:w-auto"
                  disabled={!filteredHistorySessions.length}
                  href={exportHistoryHref}
                  variant="outline"
                />
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={resetHistoryHref}>Reset</Link>
                </Button>
              </div>
            </form>

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <CardTitle className="text-lg">Attendance records</CardTitle>
                    <CardDescription>
                      {filteredHistorySessions.length} matching{" "}
                      {filteredHistorySessions.length === 1
                        ? "record"
                        : "records"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {branchScope.selectedBranchName}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {filteredHistorySessions.length ? (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {filteredHistorySessions.map((session) => {
                        const batch = batchesById.get(session.batch_id);
                        const academicYear = session.academic_year_id
                          ? academicYearsById.get(session.academic_year_id)
                          : null;
                        const sessionRecords =
                          historyRecordsBySessionId.get(session.id) ?? [];
                        const counts = getRecordStatusCounts(sessionRecords);
                        const sessionHref = getAttendanceHref({
                          academicYearId: selectedAcademicYearId,
                          batchId: session.batch_id,
                          branchId: branchScope.selectedBranchId,
                          endDate: historyEndDate,
                          historyBatchId: selectedHistoryBatchId,
                          sessionId: session.id,
                          sessionDate: session.session_date,
                          startDate: historyStartDate,
                          studentId: selectedStudentId,
                        });

                        return (
                          <article
                            key={session.id}
                            className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                          >
                            <div className="min-w-0">
                              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                                <span className="whitespace-nowrap">
                                  {formatDate(session.session_date)}
                                </span>
                                <span className="break-words">
                                  <span
                                    aria-hidden="true"
                                    className="hidden text-muted-foreground/60 sm:inline"
                                  >
                                    |{" "}
                                  </span>
                                  {batch?.name ?? "Batch not available"}
                                </span>
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="whitespace-nowrap">
                                  {academicYear?.name ??
                                    "Academic year not set"}
                                </span>
                                {session.notes ? (
                                  <span className="break-words">
                                    <span
                                      aria-hidden="true"
                                      className="hidden text-muted-foreground/60 sm:inline"
                                    >
                                      |{" "}
                                    </span>
                                    {session.notes}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
                              <Badge variant={getSessionStatusVariant(session)}>
                                {getSessionStatusLabel(session)}
                              </Badge>
                              <Badge variant="secondary">
                                Present {counts.present}
                              </Badge>
                              <Badge variant="outline">
                                Absent {counts.absent}
                              </Badge>
                              <Badge variant="outline">Late {counts.late}</Badge>
                              <Button asChild size="sm" variant="outline">
                                <Link href={sessionHref}>
                                  <Eye
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                  />
                                  View details
                                </Link>
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No attendance records match these filters"
                      description="Adjust your academic year, batch, student, or date filters to review attendance records."
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Student attendance summary
                  </CardTitle>
                  <CardDescription>
                    {selectedStudent
                      ? selectedStudent.full_name
                      : "Select a student"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedStudent ? (
                    <div className="grid gap-3">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          Total attendance records
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {selectedStudentTotalSessions}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Badge variant="secondary">
                          Present {selectedStudentCounts.present}
                        </Badge>
                        <Badge variant="outline">
                          Absent {selectedStudentCounts.absent}
                        </Badge>
                        <Badge variant="outline">
                          Late {selectedStudentCounts.late}
                        </Badge>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          Attendance percentage
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {selectedStudentAttendancePercentage}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Choose a student filter to calculate attendance.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {selectedHistorySession ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Attendance record |{" "}
                {formatDate(selectedHistorySession.session_date)}
              </CardTitle>
              <CardDescription>
                {batchesById.get(selectedHistorySession.batch_id)?.name ??
                  "Batch not available"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedHistorySessionRecords.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {selectedHistorySessionRecords.map((record) => {
                    const student = historyStudentsById.get(record.student_id);
                    const status = getRecordStatus(record.status);

                    return (
                      <article
                        key={record.id ?? record.student_id}
                        className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div>
                          <h3 className="text-sm font-medium">
                            {student?.full_name ?? "Student not available"}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {student?.phone ?? "Phone not added"}
                          </p>
                        </div>
                        <div className="grid w-full grid-cols-3 gap-2 lg:w-[300px]">
                          {statusOptions.map((option) => (
                            <span
                              key={option.value}
                              aria-current={
                                status === option.value ? "true" : undefined
                              }
                              className={getStatusPillClass(
                                status === option.value,
                              )}
                            >
                              {option.label}
                            </span>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No student entries recorded"
                  description="No student attendance entries were recorded for this date."
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        {selectedAuditSession && canViewAuditHistory ? (
          <Card>
            <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <CardTitle className="text-lg">Audit history</CardTitle>
                <CardDescription>
                  {formatDate(selectedAuditSession.session_date)} |{" "}
                  {batchesById.get(selectedAuditSession.batch_id)?.name ??
                    selectedBatch?.name ??
                    "Selected attendance record"}
                </CardDescription>
              </div>
              <Badge variant={getSessionStatusVariant(selectedAuditSession)}>
                {getSessionStatusLabel(selectedAuditSession)}
              </Badge>
            </CardHeader>
            <CardContent>
              {auditLogs.length ? (
                <div className="grid gap-3">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {visibleAuditLogs.map((log) => {
                      const student = log.student_id
                        ? auditStudentsById.get(log.student_id)
                        : null;

                      return (
                        <article
                          key={log.id}
                          className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                        >
                          <div>
                            <h3 className="text-sm font-medium">
                              {getAuditActionLabel(log.action)}
                              {student ? ` | ${student.full_name}` : ""}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {getActorLabel(log.changed_by, claims.sub)} |{" "}
                              {formatTimestamp(log.created_at)}
                            </p>
                            {log.reason ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Reason: {log.reason}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {log.old_status ? (
                              <Badge variant="outline">
                                Previous {getStatusLabel(log.old_status)}
                              </Badge>
                            ) : null}
                            {log.new_status ? (
                              <Badge variant="secondary">
                                Updated {getStatusLabel(log.new_status)}
                              </Badge>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {auditLogs.length > 2 ? (
                    <Button
                      asChild
                      variant="outline"
                      className="justify-self-start"
                    >
                      <Link href={auditToggleHref}>
                        {isAuditExpanded
                          ? "Show less"
                          : "View full audit history"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No audit entries have been recorded for this attendance
                  record yet.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </DashboardShell>
  );
}

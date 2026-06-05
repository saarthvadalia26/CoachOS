import { CalendarCheck, Download, Eye, Save, Search } from "lucide-react";
import Link from "next/link";

import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";
import { saveTodayAttendance } from "@/lib/attendance/actions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";

type AttendancePageProps = {
  searchParams: Promise<{
    academicYearId?: string;
    branchId?: string;
    batchId?: string;
    endDate?: string;
    error?: string;
    historyBatchId?: string;
    sessionId?: string;
    startDate?: string;
    studentId?: string;
  }>;
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
  id: string;
  notes: string | null;
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
  notes: string | null;
  session_date: string;
};

type StudentLookup = Student & {
  branch_id?: string | null;
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

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  const context = await requirePermission("attendance.view");
  const { accessibleBranches, supabase, claims, institute, role } = context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const todayDate = getTodayDateValue();

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
  let queryError = Boolean(batchesError || academicYearsError);

  if (selectedBatchId) {
    const { data: studentBatchRows, error: studentBatchesError } =
      await supabase
        .from("student_batches")
        .select("student_id")
        .eq("batch_id", selectedBatchId);

    queryError = queryError || Boolean(studentBatchesError);

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
      queryError = queryError || Boolean(studentsError);
    }

    const { data: sessionRow, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id, notes")
      .eq("institute_id", institute.id)
      .eq("branch_id", selectedBatch.branch_id)
      .eq("batch_id", selectedBatchId)
      .eq("session_date", todayDate)
      .maybeSingle();

    attendanceSession = sessionRow as AttendanceSession | null;
    queryError = queryError || Boolean(sessionError);

    if (attendanceSession) {
      const { data: recordRows, error: recordsError } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("session_id", attendanceSession.id);

      attendanceRecords = (recordRows ?? []) as AttendanceRecord[];
      queryError = queryError || Boolean(recordsError);
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

    queryError = queryError || Boolean(historyStudentBatchesError);

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
      queryError = queryError || Boolean(historyStudentsError);
    }
  }

  const selectedStudent =
    historyStudents.find((student) => student.id === params.studentId) ?? null;
  const selectedStudentId = selectedStudent?.id ?? "";
  let historySessions: HistorySession[] = [];

  if (historyBatchIds.length) {
    let historySessionsQuery = supabase
      .from("attendance_sessions")
      .select("id, institute_id, branch_id, batch_id, academic_year_id, session_date, notes")
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
    queryError = queryError || Boolean(historySessionsError);
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
    queryError = queryError || Boolean(historyRecordsError);
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
  const canMutateAttendance = attendanceSession
    ? canUpdateAttendance
    : canCreateAttendance;
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

  return (
    <DashboardShell
      activePage="attendance"
      instituteName={institute.name}
      role={role}
      title="Attendance"
      userEmail={claims.email}
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
              <CardTitle className="text-xl">Today&apos;s attendance</CardTitle>
              <CardDescription>
                {todayDate}
                {selectedBatch ? ` | ${selectedBatch.name}` : ""}
              </CardDescription>
            </div>
            <Badge variant={attendanceSession ? "secondary" : "outline"}>
              {attendanceSession
                ? "Session saved"
                : canMutateAttendance
                  ? "New session"
                  : "No session"}
            </Badge>
          </CardHeader>
          <CardContent>
            {params.error || queryError ? (
              <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {params.error ?? "Could not load attendance data."}
              </p>
            ) : null}

            <form className="grid gap-3 sm:grid-cols-[1fr_auto]">
              {branchScope.selectedBranchId ? (
                <input
                  name="branchId"
                  type="hidden"
                  value={branchScope.selectedBranchId}
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
              <Button
                type="submit"
                variant="outline"
                className="self-end"
                disabled={!batches.length}
              >
                <CalendarCheck aria-hidden="true" data-icon="inline-start" />
                View batch
              </Button>
            </form>
          </CardContent>
        </Card>

        {!batches.length ? (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                No batches available for attendance.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/batches">Open batches</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {selectedBatch && !students.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{selectedBatch.name}</CardTitle>
              <CardDescription>
                {canMutateAttendance
                  ? "Add students to this batch before saving attendance."
                  : "No students are assigned to this batch."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard/batches">
                  {canMutateAttendance ? "Manage batch students" : "Open batches"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {selectedBatch && students.length ? (
          <form action={canMutateAttendance ? saveTodayAttendance : undefined}>
            {canMutateAttendance ? (
              <>
                <input type="hidden" name="batchId" value={selectedBatch.id} />
                <input type="hidden" name="sessionDate" value={todayDate} />
              </>
            ) : null}
            <Card>
              <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <CardTitle className="text-lg">{selectedBatch.name}</CardTitle>
                  <CardDescription>
                    {selectedBatch.subject ?? "No subject added"}
                    {selectedBatch.schedule ? ` | ${selectedBatch.schedule}` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Present {statusCounts.present}
                  </Badge>
                  <Badge variant="outline">Absent {statusCounts.absent}</Badge>
                  <Badge variant="outline">Late {statusCounts.late}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                {canMutateAttendance ? (
                  <Label>
                    Session notes
                    <Input
                      name="notes"
                      type="text"
                      defaultValue={attendanceSession?.notes ?? ""}
                      placeholder="Optional"
                    />
                  </Label>
                ) : (
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
                    <p className="text-sm font-medium">Session notes</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {attendanceSession?.notes ?? "No notes added"}
                    </p>
                  </div>
                )}

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
                        <fieldset disabled={!canMutateAttendance}>
                          <legend className="sr-only">
                            Attendance status for {student.full_name}
                          </legend>
                          <div className="grid grid-cols-3 gap-2 sm:w-[300px]">
                            {statusOptions.map((option) => {
                              const inputId = `${student.id}-${option.value}`;
                              const isSelected =
                                currentStatus === option.value;

                              if (!canMutateAttendance) {
                                return (
                                  <span
                                    key={option.value}
                                    aria-current={isSelected ? "true" : undefined}
                                    className={getStatusPillClass(isSelected)}
                                  >
                                    {option.label}
                                  </span>
                                );
                              }

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
                                  <span className="flex h-9 items-center justify-center rounded-md border border-border px-2 text-xs font-medium text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
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

                {canMutateAttendance ? (
                  <Button type="submit" className="justify-self-start">
                    <Save aria-hidden="true" data-icon="inline-start" />
                    Save attendance
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </form>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Attendance history</CardTitle>
            <CardDescription>
              {historyStartDate} to {historyEndDate}
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
                <Button type="submit" className="w-full sm:w-auto">
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={exportHistoryHref}>
                    <Download aria-hidden="true" data-icon="inline-start" />
                    Export CSV
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={resetHistoryHref}>Reset</Link>
                </Button>
              </div>
            </form>

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <CardTitle className="text-lg">Sessions</CardTitle>
                    <CardDescription>
                      {filteredHistorySessions.length} saved{" "}
                      {filteredHistorySessions.length === 1
                        ? "session"
                        : "sessions"}
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
                          batchId: selectedBatchId,
                          branchId: branchScope.selectedBranchId,
                          endDate: historyEndDate,
                          historyBatchId: selectedHistoryBatchId,
                          sessionId: session.id,
                          startDate: historyStartDate,
                          studentId: selectedStudentId,
                        });

                        return (
                          <article
                            key={session.id}
                            className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                          >
                            <div>
                              <h3 className="text-sm font-medium">
                                {session.session_date} |{" "}
                                {batch?.name ?? "Unknown batch"}
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {academicYear?.name ?? "No academic year"}
                                {session.notes ? ` | ${session.notes}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
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
                                  Open
                                </Link>
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No attendance sessions match these filters.
                    </p>
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
                          Total sessions
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
                Session records | {selectedHistorySession.session_date}
              </CardTitle>
              <CardDescription>
                {batchesById.get(selectedHistorySession.batch_id)?.name ??
                  "Unknown batch"}
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
                            {student?.full_name ?? "Unknown student"}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {student?.phone ?? "Phone not added"}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:w-[300px]">
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
                <p className="text-sm text-muted-foreground">
                  No student records were saved for this session.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </DashboardShell>
  );
}

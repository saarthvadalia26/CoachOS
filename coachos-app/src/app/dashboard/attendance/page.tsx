import { CalendarCheck, Save } from "lucide-react";
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
    branchId?: string;
    batchId?: string;
    error?: string;
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
  student_id: string;
  status: string;
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

  let students: Student[] = [];
  let attendanceSession: AttendanceSession | null = null;
  let attendanceRecords: AttendanceRecord[] = [];
  let queryError = Boolean(batchesError);

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
      </section>
    </DashboardShell>
  );
}

"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";

const ATTENDANCE_PATH = "/dashboard/attendance";
const attendanceStatuses = ["present", "absent", "late"] as const;

type AttendanceStatus = (typeof attendanceStatuses)[number];

type AttendanceActionLogDetails = {
  batchId?: string | null;
  branchId?: string | null;
  instituteId?: string;
  membershipId?: string | null;
  operation?: "create" | "update";
  role?: string | null;
  sessionDate?: string;
  sessionId?: string | null;
  studentId?: string | null;
  userId?: string;
};

type SupabaseErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function getSupabaseErrorFields(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      details: null,
      hint: null,
      message: error instanceof Error ? error.message : null,
    };
  }

  const supabaseError = error as SupabaseErrorLike;

  return {
    code:
      typeof supabaseError.code === "string" ? supabaseError.code : null,
    details:
      typeof supabaseError.details === "string"
        ? supabaseError.details
        : null,
    hint:
      typeof supabaseError.hint === "string" ? supabaseError.hint : null,
    message:
      typeof supabaseError.message === "string"
        ? supabaseError.message
        : null,
  };
}

function logAttendanceActionError(
  step: string,
  error: unknown,
  details: AttendanceActionLogDetails = {},
) {
  console.error("Attendance save failed", {
    step,
    userId: details.userId ?? null,
    role: details.role ?? null,
    membershipId: details.membershipId ?? null,
    instituteId: details.instituteId ?? null,
    branchId: details.branchId ?? null,
    batchId: details.batchId ?? null,
    sessionDate: details.sessionDate ?? null,
    sessionId: details.sessionId ?? null,
    studentId: details.studentId ?? null,
    operation: details.operation ?? null,
    supabaseError: getSupabaseErrorFields(error),
  });
}

function redirectWithError(message: string, batchId?: string): never {
  const params = new URLSearchParams({
    error: message,
  });

  if (batchId) {
    params.set("batchId", batchId);
  }

  redirect(`${ATTENDANCE_PATH}?${params.toString()}`);
}

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirectWithError(`${label} is required.`);
  }

  return value;
}

function getOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getSessionDate(formData: FormData) {
  const value = String(formData.get("sessionDate") ?? "").trim();

  if (!value) {
    return getTodayDateValue();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

function getSubmittedAttendanceStatuses(
  formData: FormData,
  logDetails: AttendanceActionLogDetails,
  batchId: string,
) {
  const statuses = new Map<string, AttendanceStatus>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status-")) {
      continue;
    }

    const studentId = key.slice("status-".length).trim();

    if (!studentId) {
      continue;
    }

    const status = String(value);

    if (!attendanceStatuses.includes(status as AttendanceStatus)) {
      logAttendanceActionError("validate_submitted_status", null, {
        ...logDetails,
        studentId,
      });
      redirectWithError("Could not verify attendance statuses.", batchId);
    }

    statuses.set(studentId, status as AttendanceStatus);
  }

  return statuses;
}

function getAttendanceStatus(
  statuses: ReadonlyMap<string, AttendanceStatus>,
  studentId: string,
) {
  return statuses.get(studentId) ?? "present";
}

function getAttendanceLogDetails(
  context: DashboardContext,
  values: Omit<
    AttendanceActionLogDetails,
    "instituteId" | "membershipId" | "role" | "userId"
  > = {},
): AttendanceActionLogDetails {
  return {
    ...values,
    instituteId: context.institute.id,
    membershipId: context.currentMembership.id,
    role: context.role,
    userId: context.claims.sub,
  };
}

function isDuplicateKeyError(error: unknown) {
  return getSupabaseErrorFields(error).code === "23505";
}

function requireBranchPermission(
  context: DashboardContext,
  permission: Permission,
  branchId: string | null,
  batchId: string,
  sessionDate: string,
) {
  if (!branchId || !canAccessPermission(context, permission, { branchId })) {
    logAttendanceActionError(
      "attendance_permission_check",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        sessionDate,
      }),
    );
    redirectWithError("You do not have permission for that branch.", batchId);
  }
}

async function getExistingAttendanceSession(
  context: DashboardContext,
  values: {
    batchId: string;
    branchId: string;
    sessionDate: string;
  },
) {
  const { data: existingSession, error } = await context.supabase
    .from("attendance_sessions")
    .select("id")
    .eq("institute_id", context.institute.id)
    .eq("branch_id", values.branchId)
    .eq("batch_id", values.batchId)
    .eq("session_date", values.sessionDate)
    .maybeSingle();

  if (error) {
    logAttendanceActionError(
      "attendance_session_lookup",
      error,
      getAttendanceLogDetails(context, values),
    );
    redirectWithError("Could not save the attendance session.", values.batchId);
  }

  return existingSession as { id: string } | null;
}

async function createAttendanceSession(values: {
  batchId: string;
  branchId: string;
  context: DashboardContext;
  notes: string | null;
  sessionDate: string;
}) {
  const sessionId = randomUUID();
  const { error } = await values.context.supabase
    .from("attendance_sessions")
    .insert({
      id: sessionId,
      branch_id: values.branchId,
      batch_id: values.batchId,
      institute_id: values.context.institute.id,
      notes: values.notes,
      session_date: values.sessionDate,
    });

  if (error) {
    logAttendanceActionError(
      "attendance_session_insert",
      error,
      getAttendanceLogDetails(values.context, {
        batchId: values.batchId,
        branchId: values.branchId,
        operation: "create",
        sessionDate: values.sessionDate,
        sessionId,
      }),
    );

    if (!isDuplicateKeyError(error)) {
      redirectWithError(
        "Could not save the attendance session.",
        values.batchId,
      );
    }

    const existingSession = await getExistingAttendanceSession(values.context, {
      batchId: values.batchId,
      branchId: values.branchId,
      sessionDate: values.sessionDate,
    });

    if (existingSession) {
      return existingSession.id;
    }

    redirectWithError("Could not save the attendance session.", values.batchId);
  }

  return sessionId;
}

async function updateAttendanceSession(values: {
  batchId: string;
  branchId: string;
  context: DashboardContext;
  notes: string | null;
  sessionDate: string;
  sessionId: string;
}) {
  const { error } = await values.context.supabase
    .from("attendance_sessions")
    .update({
      notes: values.notes,
    })
    .eq("id", values.sessionId)
    .eq("institute_id", values.context.institute.id)
    .eq("branch_id", values.branchId)
    .eq("batch_id", values.batchId);

  if (error) {
    logAttendanceActionError(
      "attendance_session_update",
      error,
      getAttendanceLogDetails(values.context, {
        batchId: values.batchId,
        branchId: values.branchId,
        operation: "update",
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithError("Could not save the attendance session.", values.batchId);
  }

  return values.sessionId;
}

async function saveAttendanceRecords(values: {
  batchId: string;
  branchId: string;
  context: DashboardContext;
  records: Array<{
    status: AttendanceStatus;
    student_id: string;
  }>;
  sessionDate: string;
  sessionId: string;
}) {
  const studentIds = values.records.map((record) => record.student_id);
  const { data: existingRecordRows, error: existingRecordsError } =
    await values.context.supabase
      .from("attendance_records")
      .select("id, student_id")
      .eq("session_id", values.sessionId)
      .in("student_id", studentIds);

  if (existingRecordsError) {
    logAttendanceActionError(
      "attendance_records_lookup",
      existingRecordsError,
      getAttendanceLogDetails(values.context, {
        batchId: values.batchId,
        branchId: values.branchId,
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithError("Could not save the attendance records.", values.batchId);
  }

  const existingRecordsByStudentId = new Map(
    ((existingRecordRows ?? []) as Array<{ id: string; student_id: string }>)
      .map((record) => [record.student_id, record.id]),
  );

  for (const record of values.records) {
    const existingRecordId = existingRecordsByStudentId.get(record.student_id);

    if (existingRecordId) {
      const { error } = await values.context.supabase
        .from("attendance_records")
        .update({
          status: record.status,
        })
        .eq("id", existingRecordId)
        .eq("session_id", values.sessionId)
        .eq("student_id", record.student_id);

      if (error) {
        logAttendanceActionError(
          "attendance_record_update",
          error,
          getAttendanceLogDetails(values.context, {
            batchId: values.batchId,
            branchId: values.branchId,
            operation: "update",
            sessionDate: values.sessionDate,
            sessionId: values.sessionId,
            studentId: record.student_id,
          }),
        );
        redirectWithError(
          "Could not save the attendance records.",
          values.batchId,
        );
      }

      continue;
    }

    const { error } = await values.context.supabase
      .from("attendance_records")
      .insert({
        session_id: values.sessionId,
        student_id: record.student_id,
        status: record.status,
      });

    if (error) {
      logAttendanceActionError(
        "attendance_record_insert",
        error,
        getAttendanceLogDetails(values.context, {
          batchId: values.batchId,
          branchId: values.branchId,
          operation: "create",
          sessionDate: values.sessionDate,
          sessionId: values.sessionId,
          studentId: record.student_id,
        }),
      );
      redirectWithError(
        "Could not save the attendance records.",
        values.batchId,
      );
    }
  }
}

export async function saveTodayAttendance(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const batchId = getRequiredText(formData, "batchId", "Batch");
  const notes = getOptionalText(formData, "notes");
  const sessionDate = getSessionDate(formData);

  if (!sessionDate) {
    logAttendanceActionError(
      "validate_session_date",
      null,
      getAttendanceLogDetails(context, {
        batchId,
      }),
    );
    redirectWithError("Could not verify the attendance date.", batchId);
  }

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, institute_id, branch_id")
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (batchError) {
    logAttendanceActionError(
      "batch_lookup",
      batchError,
      getAttendanceLogDetails(context, {
        batchId,
        sessionDate,
      }),
    );
    redirectWithError("Could not verify the selected batch.", batchId);
  }

  if (!batch) {
    redirectWithError("Select a batch from this institute.", batchId);
  }

  if (!batch.branch_id || batch.institute_id !== institute.id) {
    logAttendanceActionError(
      "validate_batch_scope",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId: batch.branch_id,
        sessionDate,
      }),
    );
    redirectWithError("Could not verify the selected batch.", batchId);
  }

  const branchId = batch.branch_id;
  const submittedStatuses = getSubmittedAttendanceStatuses(
    formData,
    getAttendanceLogDetails(context, {
      batchId,
      branchId,
      sessionDate,
    }),
    batchId,
  );

  const { data: studentBatches, error: studentBatchesError } = await supabase
    .from("student_batches")
    .select("student_id")
    .eq("batch_id", batchId);

  if (studentBatchesError) {
    logAttendanceActionError(
      "student_batches_lookup",
      studentBatchesError,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        sessionDate,
      }),
    );
    redirectWithError("Could not load the batch students.", batchId);
  }

  const studentIds = (studentBatches ?? [])
    .map((studentBatch) => studentBatch.student_id)
    .filter(Boolean);
  const assignedStudentIds = new Set(studentIds);
  const unassignedSubmittedStudentIds = Array.from(submittedStatuses.keys())
    .filter((studentId) => !assignedStudentIds.has(studentId));

  if (unassignedSubmittedStudentIds.length) {
    logAttendanceActionError(
      "validate_submitted_students_in_batch",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        sessionDate,
      }),
    );
    redirectWithError("Could not verify the submitted students.", batchId);
  }

  if (!studentIds.length) {
    redirectWithError(
      "Add students to this batch before saving attendance.",
      batchId,
    );
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, branch_id")
    .eq("institute_id", institute.id)
    .eq("branch_id", branchId)
    .in("id", studentIds);

  if (studentsError) {
    logAttendanceActionError(
      "students_branch_lookup",
      studentsError,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        sessionDate,
      }),
    );
    redirectWithError("Could not verify the batch students.", batchId);
  }

  const sameBranchStudentIds = (students ?? []).map((student) => student.id);

  if (sameBranchStudentIds.length !== studentIds.length) {
    logAttendanceActionError(
      "validate_students_branch",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        sessionDate,
      }),
    );
    redirectWithError("Could not verify the batch students.", batchId);
  }

  const existingSession = await getExistingAttendanceSession(context, {
    batchId,
    branchId,
    sessionDate,
  });

  requireBranchPermission(
    context,
    existingSession ? "attendance.update" : "attendance.create",
    branchId,
    batchId,
    sessionDate,
  );

  const sessionId = existingSession
    ? await updateAttendanceSession({
        batchId,
        branchId,
        context,
        notes,
        sessionDate,
        sessionId: existingSession.id,
      })
    : await createAttendanceSession({
        batchId,
        branchId,
        context,
        notes,
        sessionDate,
      });

  const attendanceRecords = sameBranchStudentIds.map((studentId) => ({
    student_id: studentId,
    status: getAttendanceStatus(submittedStatuses, studentId),
  }));

  await saveAttendanceRecords({
    batchId,
    branchId,
    context,
    records: attendanceRecords,
    sessionDate,
    sessionId,
  });

  revalidatePath(ATTENDANCE_PATH);
  const params = new URLSearchParams({
    batchId,
    branchId,
  });

  redirect(`${ATTENDANCE_PATH}?${params.toString()}`);
}

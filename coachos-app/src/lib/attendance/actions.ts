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
const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

type AttendanceStatus = (typeof attendanceStatuses)[number];

type AttendanceActionLogDetails = {
  action?: string | null;
  academicYearId?: string | null;
  batchId?: string | null;
  branchId?: string | null;
  instituteId?: string;
  lockedAt?: string | null;
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

type AttendanceAuditAction =
  | "session_created"
  | "session_locked"
  | "session_reopened"
  | "status_changed"
  | "notes_changed";

type AttendanceAuditLogInput = {
  action: AttendanceAuditAction;
  newStatus?: AttendanceStatus | null;
  oldStatus?: AttendanceStatus | null;
  reason?: string | null;
  studentId?: string | null;
};

type AttendanceSessionLookup = {
  academic_year_id: string | null;
  id: string;
  locked_at: string | null;
  locked_by: string | null;
  notes: string | null;
  reopen_count: number;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
};

type AttendanceReopenAccess = {
  canReopen: boolean;
  isBranchManager: boolean;
  isOwner: boolean;
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
    academicYearId: details.academicYearId ?? null,
    sessionDate: details.sessionDate ?? null,
    sessionId: details.sessionId ?? null,
    studentId: details.studentId ?? null,
    action: details.action ?? null,
    lockedAt: details.lockedAt ?? null,
    operation: details.operation ?? null,
    supabaseError: getSupabaseErrorFields(error),
  });
}

function logAttendanceSaveStep(
  step: string,
  details: AttendanceActionLogDetails = {},
) {
  console.info("Attendance save step", {
    step,
    userId: details.userId ?? null,
    role: details.role ?? null,
    membershipId: details.membershipId ?? null,
    instituteId: details.instituteId ?? null,
    branchId: details.branchId ?? null,
    batchId: details.batchId ?? null,
    academicYearId: details.academicYearId ?? null,
    sessionDate: details.sessionDate ?? null,
    sessionId: details.sessionId ?? null,
    studentId: details.studentId ?? null,
    action: details.action ?? null,
    lockedAt: details.lockedAt ?? null,
    operation: details.operation ?? null,
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

function redirectWithAttendanceSaveError(batchId?: string): never {
  redirectWithError(
    "This attendance record could not be saved. Please check the selected batch and try again.",
    batchId,
  );
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
      redirectWithError("Attendance statuses could not be verified.", batchId);
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
    .select(
      "id, academic_year_id, locked_at, locked_by, notes, reopen_count, reopened_at, reopened_by, reopen_reason",
    )
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
    redirectWithAttendanceSaveError(values.batchId);
  }

  return existingSession as AttendanceSessionLookup | null;
}

async function verifyAttendanceLockingSchema(
  context: DashboardContext,
  values: {
    batchId: string;
    branchId: string;
    sessionDate: string;
  },
) {
  const { error: sessionColumnsError } = await context.supabase
    .from("attendance_sessions")
    .select(
      "id, locked_at, locked_by, reopened_at, reopened_by, reopen_reason, reopen_count",
    )
    .eq("id", EMPTY_UUID)
    .maybeSingle();

  if (sessionColumnsError) {
    logAttendanceActionError(
      "attendance_locking_schema_check",
      sessionColumnsError,
      getAttendanceLogDetails(context, values),
    );
    redirectWithAttendanceSaveError(values.batchId);
  }

  const { error: auditTableError } = await context.supabase
    .from("attendance_audit_logs")
    .select("id")
    .limit(0);

  if (auditTableError) {
    logAttendanceActionError(
      "attendance_audit_schema_check",
      auditTableError,
      getAttendanceLogDetails(context, values),
    );
    redirectWithAttendanceSaveError(values.batchId);
  }
}

async function getActiveAcademicYearId(
  context: DashboardContext,
  values: {
    batchId: string;
    branchId: string;
    sessionDate: string;
  },
) {
  const { data: academicYear, error } = await context.supabase
    .from("academic_years")
    .select("id")
    .eq("institute_id", context.institute.id)
    .eq("is_active", true)
    .lte("start_date", values.sessionDate)
    .gte("end_date", values.sessionDate)
    .maybeSingle();

  if (error) {
    logAttendanceActionError(
      "active_academic_year_lookup",
      error,
      getAttendanceLogDetails(context, values),
    );
    redirectWithAttendanceSaveError(values.batchId);
  }

  return academicYear?.id ?? null;
}

async function createAttendanceSession(values: {
  academicYearId: string | null;
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
      academic_year_id: values.academicYearId,
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
        academicYearId: values.academicYearId,
        operation: "create",
        sessionDate: values.sessionDate,
        sessionId,
      }),
    );

    if (!isDuplicateKeyError(error)) {
      redirectWithError(
        "This attendance record could not be saved. Please check the selected batch and try again.",
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

    redirectWithAttendanceSaveError(values.batchId);
  }

  return sessionId;
}

async function updateAttendanceSession(values: {
  academicYearId: string | null;
  batchId: string;
  branchId: string;
  context: DashboardContext;
  existingAcademicYearId: string | null;
  existingNotes: string | null;
  notes: string | null;
  sessionDate: string;
  sessionId: string;
}) {
  const updateValues: {
    academic_year_id?: string;
    notes: string | null;
  } = {
    notes: values.notes,
  };

  if (!values.existingAcademicYearId && values.academicYearId) {
    updateValues.academic_year_id = values.academicYearId;
  }

  const { error } = await values.context.supabase
    .from("attendance_sessions")
    .update(updateValues)
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
        academicYearId: values.academicYearId,
        operation: "update",
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithAttendanceSaveError(values.batchId);
  }

  return {
    notesChanged: values.existingNotes !== values.notes,
    sessionId: values.sessionId,
  };
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
}): Promise<AttendanceAuditLogInput[]> {
  const studentIds = values.records.map((record) => record.student_id);
  const { data: existingRecordRows, error: existingRecordsError } =
    await values.context.supabase
      .from("attendance_records")
      .select("id, student_id, status")
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
    redirectWithAttendanceSaveError(values.batchId);
  }

  const existingRecordsByStudentId = new Map(
    ((existingRecordRows ?? []) as Array<{
      id: string;
      status: AttendanceStatus | string | null;
      student_id: string;
    }>).map((record) => [
      record.student_id,
      {
        id: record.id,
        status: attendanceStatuses.includes(record.status as AttendanceStatus)
          ? (record.status as AttendanceStatus)
          : null,
      },
    ]),
  );
  const auditLogs: AttendanceAuditLogInput[] = [];

  for (const record of values.records) {
    const existingRecord = existingRecordsByStudentId.get(record.student_id);

    if (existingRecord) {
      if (existingRecord.status === record.status) {
        continue;
      }

      const { error } = await values.context.supabase
        .from("attendance_records")
        .update({
          status: record.status,
        })
        .eq("id", existingRecord.id)
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
          "This attendance record could not be saved. Please check the selected batch and try again.",
          values.batchId,
        );
      }

      auditLogs.push({
        action: "status_changed",
        newStatus: record.status,
        oldStatus: existingRecord.status,
        studentId: record.student_id,
      });

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
        "This attendance record could not be saved. Please check the selected batch and try again.",
        values.batchId,
      );
    }

    auditLogs.push({
      action: "status_changed",
      newStatus: record.status,
      oldStatus: null,
      studentId: record.student_id,
    });
  }

  return auditLogs;
}

async function writeAttendanceAuditLogs(values: {
  batchId: string;
  branchId: string;
  context: DashboardContext;
  logs: AttendanceAuditLogInput[];
  sessionDate: string;
  sessionId: string;
}) {
  if (!values.logs.length) {
    return;
  }

  const { error } = await values.context.supabase
    .from("attendance_audit_logs")
    .insert(
      values.logs.map((log) => ({
        action: log.action,
        branch_id: values.branchId,
        changed_by: values.context.claims.sub,
        institute_id: values.context.institute.id,
        new_status: log.newStatus ?? null,
        old_status: log.oldStatus ?? null,
        reason: log.reason ?? null,
        session_id: values.sessionId,
        student_id: log.studentId ?? null,
      })),
    );

  if (error) {
    logAttendanceActionError(
      "attendance_audit_insert",
      error,
      getAttendanceLogDetails(values.context, {
        action: values.logs.map((log) => log.action).join(","),
        batchId: values.batchId,
        branchId: values.branchId,
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithAttendanceSaveError(values.batchId);
  }
}

async function lockAttendanceSession(values: {
  batchId: string;
  branchId: string;
  context: DashboardContext;
  sessionDate: string;
  sessionId: string;
}) {
  const lockedAt = new Date().toISOString();
  const { data: lockedSession, error } = await values.context.supabase
    .from("attendance_sessions")
    .update({
      locked_at: lockedAt,
      locked_by: values.context.claims.sub,
    })
    .eq("id", values.sessionId)
    .eq("institute_id", values.context.institute.id)
    .eq("branch_id", values.branchId)
    .eq("batch_id", values.batchId)
    .select("id, locked_at, locked_by")
    .maybeSingle();

  if (error) {
    logAttendanceActionError(
      "attendance_session_lock",
      error,
      getAttendanceLogDetails(values.context, {
        batchId: values.batchId,
        branchId: values.branchId,
        lockedAt,
        operation: "update",
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithError(
      "The attendance record was saved but could not be locked. Please try again.",
      values.batchId,
    );
  }

  if (
    !lockedSession?.locked_at ||
    lockedSession.locked_by !== values.context.claims.sub
  ) {
    logAttendanceActionError(
      "attendance_session_lock_verification",
      null,
      getAttendanceLogDetails(values.context, {
        batchId: values.batchId,
        branchId: values.branchId,
        lockedAt: lockedSession?.locked_at ?? null,
        operation: "update",
        sessionDate: values.sessionDate,
        sessionId: values.sessionId,
      }),
    );
    redirectWithError(
      "The attendance record was saved but could not be locked. Please try again.",
      values.batchId,
    );
  }
}

function getAttendanceReopenAccess(
  context: DashboardContext,
  branchId: string,
): AttendanceReopenAccess {
  const isOwner = context.memberships.some((membership) => {
    if (membership.role === "owner") {
      return canAccessPermission(context, "attendance.update", { branchId });
    }

    return false;
  });
  const isBranchManager = context.memberships.some((membership) => {
    return (
      membership.role === "branch_manager" &&
      membership.branch_id === branchId &&
      canAccessPermission(context, "attendance.update", { branchId })
    );
  });

  return {
    canReopen: isOwner || isBranchManager,
    isBranchManager,
    isOwner,
  };
}

export async function saveTodayAttendance(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const batchId = getRequiredText(formData, "batchId", "Batch");
  const notes = getOptionalText(formData, "notes");
  const sessionDate = getSessionDate(formData);

  logAttendanceSaveStep(
    "save_started",
    getAttendanceLogDetails(context, {
      batchId,
      sessionDate: sessionDate ?? undefined,
    }),
  );

  if (!sessionDate) {
    logAttendanceActionError(
      "validate_session_date",
      null,
      getAttendanceLogDetails(context, {
        batchId,
      }),
    );
    redirectWithError("Please select a valid attendance date.", batchId);
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
    redirectWithError("Please select a valid batch and try again.", batchId);
  }

  if (!batch) {
    redirectWithError("Please select a batch from this institute.", batchId);
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
    redirectWithError("Please select a valid batch and try again.", batchId);
  }

  const branchId = batch.branch_id;

  await verifyAttendanceLockingSchema(context, {
    batchId,
    branchId,
    sessionDate,
  });

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
    redirectWithError(
      "Student records for this batch are unavailable right now. Please try again.",
      batchId,
    );
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
    redirectWithError(
      "Attendance includes students outside this batch.",
      batchId,
    );
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
    redirectWithError("Students for this batch could not be verified.", batchId);
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
    redirectWithError("Students for this batch could not be verified.", batchId);
  }

  const existingSession = await getExistingAttendanceSession(context, {
    batchId,
    branchId,
    sessionDate,
  });

  if (existingSession?.locked_at) {
    logAttendanceActionError(
      "validate_attendance_session_unlocked",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId,
        lockedAt: existingSession.locked_at,
        sessionDate,
        sessionId: existingSession.id,
      }),
    );
    redirectWithError(
      "This attendance record is locked. Reopen it before making corrections.",
      batchId,
    );
  }

  requireBranchPermission(
    context,
    existingSession ? "attendance.update" : "attendance.create",
    branchId,
    batchId,
    sessionDate,
  );
  logAttendanceSaveStep(
    "permission_verified",
    getAttendanceLogDetails(context, {
      batchId,
      branchId,
      operation: existingSession ? "update" : "create",
      sessionDate,
      sessionId: existingSession?.id,
    }),
  );

  const activeAcademicYearId = await getActiveAcademicYearId(context, {
    batchId,
    branchId,
    sessionDate,
  });

  const sessionResult = existingSession
    ? await updateAttendanceSession({
        academicYearId: activeAcademicYearId,
        batchId,
        branchId,
        context,
        existingAcademicYearId: existingSession.academic_year_id,
        existingNotes: existingSession.notes,
        notes,
        sessionDate,
        sessionId: existingSession.id,
      })
    : {
        notesChanged: false,
        sessionId: await createAttendanceSession({
          academicYearId: activeAcademicYearId,
          batchId,
          branchId,
          context,
          notes,
          sessionDate,
        }),
      };
  const sessionId = sessionResult.sessionId;
  logAttendanceSaveStep(
    "attendance_session_ready",
    getAttendanceLogDetails(context, {
      academicYearId: activeAcademicYearId,
      batchId,
      branchId,
      operation: existingSession ? "update" : "create",
      sessionDate,
      sessionId,
    }),
  );

  const attendanceRecords = sameBranchStudentIds.map((studentId) => ({
    student_id: studentId,
    status: getAttendanceStatus(submittedStatuses, studentId),
  }));

  const auditLogs: AttendanceAuditLogInput[] = existingSession
    ? []
    : [{ action: "session_created" }];

  if (existingSession && sessionResult.notesChanged) {
    auditLogs.push({
      action: "notes_changed",
    });
  }

  auditLogs.push(
    ...(await saveAttendanceRecords({
      batchId,
      branchId,
      context,
      records: attendanceRecords,
      sessionDate,
      sessionId,
    })),
  );
  logAttendanceSaveStep(
    "attendance_records_saved",
    getAttendanceLogDetails(context, {
      batchId,
      branchId,
      sessionDate,
      sessionId,
    }),
  );

  await writeAttendanceAuditLogs({
    batchId,
    branchId,
    context,
    logs: auditLogs,
    sessionDate,
    sessionId,
  });
  logAttendanceSaveStep(
    "attendance_audit_written",
    getAttendanceLogDetails(context, {
      action: auditLogs.map((log) => log.action).join(","),
      batchId,
      branchId,
      sessionDate,
      sessionId,
    }),
  );

  await lockAttendanceSession({
    batchId,
    branchId,
    context,
    sessionDate,
    sessionId,
  });
  logAttendanceSaveStep(
    "attendance_session_locked",
    getAttendanceLogDetails(context, {
      batchId,
      branchId,
      operation: "update",
      sessionDate,
      sessionId,
    }),
  );

  await writeAttendanceAuditLogs({
    batchId,
    branchId,
    context,
    logs: [{ action: "session_locked" }],
    sessionDate,
    sessionId,
  });
  logAttendanceSaveStep(
    "attendance_lock_audit_written",
    getAttendanceLogDetails(context, {
      action: "session_locked",
      batchId,
      branchId,
      sessionDate,
      sessionId,
    }),
  );

  revalidatePath(ATTENDANCE_PATH);
  const params = new URLSearchParams({
    batchId,
    branchId,
    sessionDate,
    success: "Attendance submitted and locked.",
  });

  redirect(`${ATTENDANCE_PATH}?${params.toString()}`);
}

export async function reopenAttendanceSession(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const sessionId = getRequiredText(
    formData,
    "sessionId",
    "Attendance record",
  );
  const batchId = String(formData.get("batchId") ?? "").trim() || undefined;
  const reason = getRequiredText(formData, "reopenReason", "Reopen reason");

  const { data: session, error: sessionError } = await supabase
    .from("attendance_sessions")
    .select(
      "id, institute_id, branch_id, batch_id, session_date, locked_at, reopen_count",
    )
    .eq("id", sessionId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (sessionError) {
    logAttendanceActionError(
      "reopen_session_lookup",
      sessionError,
      getAttendanceLogDetails(context, {
        batchId,
        sessionId,
      }),
    );
    redirectWithError(
      "Attendance record could not be reopened. Please try again.",
      batchId,
    );
  }

  if (!session?.branch_id || !session.batch_id) {
    logAttendanceActionError(
      "validate_reopen_session_scope",
      null,
      getAttendanceLogDetails(context, {
        batchId,
        branchId: session?.branch_id,
        sessionId,
      }),
    );
    redirectWithError("Attendance record could not be verified.", batchId);
  }

  if (!session.locked_at) {
    redirectWithError("This attendance record is already editable.", batchId);
  }

  const reopenAccess = getAttendanceReopenAccess(context, session.branch_id);

  if (!reopenAccess.canReopen) {
    logAttendanceActionError(
      "reopen_permission_check",
      null,
      getAttendanceLogDetails(context, {
        batchId: session.batch_id,
        branchId: session.branch_id,
        lockedAt: session.locked_at,
        sessionDate: session.session_date,
        sessionId,
      }),
    );
    redirectWithError(
      "You do not have permission to perform this action.",
      batchId,
    );
  }

  if (
    reopenAccess.isBranchManager &&
    !reopenAccess.isOwner &&
    session.reopen_count >= 2
  ) {
    logAttendanceActionError(
      "reopen_limit_check",
      null,
      getAttendanceLogDetails(context, {
        batchId: session.batch_id,
        branchId: session.branch_id,
        lockedAt: session.locked_at,
        sessionDate: session.session_date,
        sessionId,
      }),
    );
    redirectWithError(
      "This attendance record has reached the reopen limit. Please contact the institute owner for further changes.",
      batchId,
    );
  }

  const reopenedAt = new Date().toISOString();
  const currentReopenCount = Number(session.reopen_count ?? 0);
  const nextReopenCount =
    reopenAccess.isBranchManager && !reopenAccess.isOwner
      ? currentReopenCount + 1
      : currentReopenCount;
  const { data: reopenedSession, error: reopenError } = await supabase
    .from("attendance_sessions")
    .update({
      locked_at: null,
      locked_by: null,
      reopen_count: nextReopenCount,
      reopened_at: reopenedAt,
      reopened_by: context.claims.sub,
      reopen_reason: reason,
    })
    .eq("id", sessionId)
    .eq("institute_id", institute.id)
    .eq("branch_id", session.branch_id)
    .select(
      "id, locked_at, locked_by, reopen_count, reopened_at, reopened_by, reopen_reason",
    )
    .maybeSingle();

  if (reopenError) {
    logAttendanceActionError(
      "attendance_session_reopen",
      reopenError,
      getAttendanceLogDetails(context, {
        batchId: session.batch_id,
        branchId: session.branch_id,
        lockedAt: session.locked_at,
        operation: "update",
        sessionDate: session.session_date,
        sessionId,
      }),
    );
    redirectWithError(
      "Attendance record could not be reopened. Please try again.",
      batchId,
    );
  }

  if (
    !reopenedSession ||
    reopenedSession.locked_at ||
    reopenedSession.locked_by ||
    reopenedSession.reopen_count !== nextReopenCount ||
    !reopenedSession.reopened_at ||
    reopenedSession.reopened_by !== context.claims.sub ||
    reopenedSession.reopen_reason !== reason
  ) {
    logAttendanceActionError(
      "attendance_session_reopen_verification",
      null,
      getAttendanceLogDetails(context, {
        batchId: session.batch_id,
        branchId: session.branch_id,
        lockedAt: reopenedSession?.locked_at ?? null,
        operation: "update",
        sessionDate: session.session_date,
        sessionId,
      }),
    );
    redirectWithError(
      "Attendance record could not be reopened. Please try again.",
      batchId,
    );
  }

  await writeAttendanceAuditLogs({
    batchId: session.batch_id,
    branchId: session.branch_id,
    context,
    logs: [
      {
        action: "session_reopened",
        reason,
      },
    ],
    sessionDate: session.session_date,
    sessionId,
  });

  revalidatePath(ATTENDANCE_PATH);
  const params = new URLSearchParams({
    batchId: session.batch_id,
    branchId: session.branch_id,
    sessionDate: session.session_date,
    success: "Attendance reopened. Submit corrections to lock it again.",
  });

  redirect(`${ATTENDANCE_PATH}?${params.toString()}`);
}

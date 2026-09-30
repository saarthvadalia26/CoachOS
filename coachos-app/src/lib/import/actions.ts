"use server";

import { revalidatePath } from "next/cache";

import {
  canAccessPermission,
  requireDashboardAccess,
  type Branch,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import {
  normalizeCsvValue,
  normalizeLookupValue,
  parseCsv,
} from "@/lib/import/csv";
import type {
  ImportActionResult,
  ImportRowIssue,
  ImportSummary,
} from "@/lib/import/types";

const IMPORT_FAILED_MESSAGE = "Import failed. Please review the CSV.";
const MAX_CSV_CHAR_LENGTH = 2 * 1024 * 1024; // 2MB max payload
const MAX_IMPORT_ROWS = 1000; // 1,000 rows max per batch import

type PreparedStudent = {
  archived_at: string | null;
  archived_by: string | null;
  branch_id: string;
  full_name: string;
  institute_id: string;
  parent_email: string | null;
  parent_phone: string | null;
  phone: string | null;
  status: "active" | "inactive";
  student_email: string | null;
};

type PreparedBatch = {
  branch_id: string;
  institute_id: string;
  name: string;
  subject: string | null;
};

type PreparedAssignment = {
  batch_id: string;
  student_id: string;
};

type ExistingStudent = {
  archived_at: string | null;
  branch_id: string;
  full_name: string;
  id: string;
  phone: string | null;
};

type ExistingBatch = {
  branch_id: string;
  id: string;
  name: string;
};

type ExistingStudentBatch = {
  batch_id: string;
  student_id: string;
};

function emptySummary(totalRows = 0): ImportSummary {
  return {
    errorRows: 0,
    errors: [],
    importedRows: 0,
    skippedRows: 0,
    totalRows,
  };
}

function errorResult(
  message: string,
  summary: ImportSummary,
): ImportActionResult {
  return {
    message,
    ok: false,
    summary,
  };
}

function successResult(
  message: string,
  summary: ImportSummary,
): ImportActionResult {
  return {
    message,
    ok: true,
    summary,
  };
}

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {};
  }

  const errorRecord = error as Record<string, unknown>;

  return {
    code:
      typeof errorRecord.code === "string" ? errorRecord.code : undefined,
    details:
      typeof errorRecord.details === "string"
        ? errorRecord.details
        : undefined,
    hint:
      typeof errorRecord.hint === "string" ? errorRecord.hint : undefined,
    message:
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : undefined,
  };
}

function logImportFailure({
  context,
  error,
  operation,
  rowNumber,
}: {
  context: DashboardContext;
  error: unknown;
  operation: string;
  rowNumber?: number;
}) {
  const errorDetails = getSupabaseErrorDetails(error);

  console.error("CSV import failed", {
    errorCode: errorDetails.code,
    errorDetails: errorDetails.details,
    errorHint: errorDetails.hint,
    errorMessage: errorDetails.message,
    instituteId: context.institute.id,
    membershipId: context.currentMembership.id,
    operation,
    role: context.role,
    rowNumber,
    userId: context.claims.sub,
  });
}

function getMissingColumns(
  headers: readonly string[],
  requiredColumns: readonly string[],
  context: DashboardContext,
) {
  const required = context.branchScope === "all"
    ? [...requiredColumns, "branch_name"]
    : [...requiredColumns];

  return required.filter((column) => !headers.includes(column));
}

function requireAnyPermission(
  context: DashboardContext,
  permissions: readonly Permission[],
) {
  return permissions.some((permission) =>
    canAccessPermission(context, permission),
  );
}

function getBranchesByName(branches: readonly Branch[]) {
  return new Map(
    branches.map((branch) => [normalizeLookupValue(branch.name), branch]),
  );
}

function resolveRowBranch({
  context,
  rowNumber,
  value,
}: {
  context: DashboardContext;
  rowNumber: number;
  value: string | null | undefined;
}) {
  const branchName = normalizeCsvValue(value);

  if (context.branchScope === "all") {
    if (!branchName) {
      return {
        error: {
          message: "branch_name is required for owner imports.",
          rowNumber,
        },
      };
    }

    const branch = getBranchesByName(context.accessibleBranches).get(
      normalizeLookupValue(branchName),
    );

    if (!branch) {
      return {
        error: {
          message: `Branch "${branchName}" was not found in this institute.`,
          rowNumber,
        },
      };
    }

    return { branch };
  }

  const assignedBranch = context.accessibleBranches.find(
    (branch) => branch.id === context.branchId,
  ) ?? context.accessibleBranches[0];

  if (!assignedBranch) {
    return {
      error: {
        message: "No assigned branch is available for this import.",
        rowNumber,
      },
    };
  }

  if (branchName && normalizeLookupValue(branchName) !== normalizeLookupValue(assignedBranch.name)) {
    return {
      error: {
        message: "Rows must use your assigned branch only.",
        rowNumber,
      },
    };
  }

  return { branch: assignedBranch };
}

function requireBranchPermissionForRow({
  branchId,
  context,
  permission,
  rowNumber,
}: {
  branchId: string;
  context: DashboardContext;
  permission: Permission;
  rowNumber: number;
}) {
  if (!canAccessPermission(context, permission, { branchId })) {
    return {
      message: "You do not have permission to import into this branch.",
      rowNumber,
    };
  }

  return null;
}

function withValidationErrors(
  summary: ImportSummary,
  errors: ImportRowIssue[],
) {
  return {
    ...summary,
    errorRows: new Set(errors.map((error) => error.rowNumber)).size,
    errors,
  };
}

function rowValue(
  values: Record<string, string>,
  key: string,
) {
  return normalizeCsvValue(values[key]);
}

function nullableRowValue(
  values: Record<string, string>,
  key: string,
) {
  const value = rowValue(values, key);

  return value || null;
}

function getStudentDuplicateKey({
  branchId,
  fullName,
  phone,
}: {
  branchId: string;
  fullName: string;
  phone: string | null;
}) {
  return [
    branchId,
    normalizeLookupValue(fullName),
    normalizeLookupValue(phone),
  ].join("|");
}

function getBatchDuplicateKey(branchId: string, name: string) {
  return [branchId, normalizeLookupValue(name)].join("|");
}

export async function importStudentsFromCsv(
  csvText: string,
): Promise<ImportActionResult> {
  const context = await requireDashboardAccess();

  if (!canAccessPermission(context, "students.create")) {
    return errorResult(
      "You do not have permission to import students.",
      emptySummary(),
    );
  }

  if (!csvText || typeof csvText !== "string" || csvText.length > MAX_CSV_CHAR_LENGTH) {
    return errorResult(
      "CSV file size exceeds the 2MB limit. Please upload a smaller file.",
      emptySummary(),
    );
  }

  const parsed = parseCsv(csvText);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return errorResult(
      `CSV contains ${parsed.rows.length} rows. Maximum allowed per import is ${MAX_IMPORT_ROWS} rows.`,
      emptySummary(parsed.rows.length),
    );
  }
  const summary = emptySummary(parsed.rows.length);
  const errors: ImportRowIssue[] = [...parsed.errors];
  const missingColumns = getMissingColumns(
    parsed.headers,
    ["full_name"],
    context,
  );

  for (const column of missingColumns) {
    errors.push({
      message: `Missing required column: ${column}.`,
      rowNumber: 1,
    });
  }

  const preparedStudents: Array<PreparedStudent & { rowNumber: number }> = [];

  for (const row of parsed.rows) {
    const fullName = rowValue(row.values, "full_name");
    const status = normalizeLookupValue(row.values.status) || "active";

    if (!fullName) {
      errors.push({ message: "full_name is required.", rowNumber: row.rowNumber });
      continue;
    }

    if (!["active", "archived", "inactive"].includes(status)) {
      errors.push({
        message: "status must be active, inactive, or archived.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const branchResult = resolveRowBranch({
      context,
      rowNumber: row.rowNumber,
      value: row.values.branch_name,
    });

    if (branchResult.error || !branchResult.branch) {
      errors.push(branchResult.error ?? {
        message: "Branch could not be resolved.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const permissionError = requireBranchPermissionForRow({
      branchId: branchResult.branch.id,
      context,
      permission: "students.create",
      rowNumber: row.rowNumber,
    });

    if (permissionError) {
      errors.push(permissionError);
      continue;
    }

    const isArchived = status === "archived";

    if (
      isArchived &&
      !canAccessPermission(context, "students.delete", {
        branchId: branchResult.branch.id,
      })
    ) {
      errors.push({
        message: "You do not have permission to import archived students.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    preparedStudents.push({
      archived_at: isArchived ? new Date().toISOString() : null,
      archived_by: isArchived ? context.claims.sub : null,
      branch_id: branchResult.branch.id,
      full_name: fullName,
      institute_id: context.institute.id,
      parent_email: nullableRowValue(row.values, "parent_email"),
      parent_phone: nullableRowValue(row.values, "parent_phone"),
      phone: nullableRowValue(row.values, "phone"),
      rowNumber: row.rowNumber,
      status: isArchived ? "inactive" : (status as "active" | "inactive"),
      student_email: nullableRowValue(row.values, "student_email"),
    });
  }

  if (errors.length) {
    return errorResult(
      IMPORT_FAILED_MESSAGE,
      withValidationErrors(summary, errors),
    );
  }

  if (!preparedStudents.length) {
    return errorResult(
      "No valid student rows were found.",
      withValidationErrors(summary, errors),
    );
  }

  const branchIds = Array.from(
    new Set(preparedStudents.map((student) => student.branch_id)),
  );
  const { data: existingRows, error: existingError } = await context.supabase
    .from("students")
    .select("id, branch_id, full_name, phone, archived_at")
    .eq("institute_id", context.institute.id)
    .in("branch_id", branchIds);

  if (existingError) {
    logImportFailure({
      context,
      error: existingError,
      operation: "students_duplicate_lookup",
    });
    return errorResult(
      "Students could not be imported. Please try again.",
      summary,
    );
  }

  const existingKeys = new Set(
    ((existingRows ?? []) as ExistingStudent[]).map((student) =>
      getStudentDuplicateKey({
        branchId: student.branch_id,
        fullName: student.full_name,
        phone: student.phone,
      }),
    ),
  );
  const csvKeys = new Set<string>();
  const rowsToInsert: PreparedStudent[] = [];
  let skippedRows = 0;

  for (const student of preparedStudents) {
    const duplicateKey = getStudentDuplicateKey({
      branchId: student.branch_id,
      fullName: student.full_name,
      phone: student.phone,
    });

    if (existingKeys.has(duplicateKey) || csvKeys.has(duplicateKey)) {
      skippedRows += 1;
      continue;
    }

    csvKeys.add(duplicateKey);
    rowsToInsert.push({
      archived_at: student.archived_at,
      archived_by: student.archived_by,
      branch_id: student.branch_id,
      full_name: student.full_name,
      institute_id: student.institute_id,
      parent_email: student.parent_email,
      parent_phone: student.parent_phone,
      phone: student.phone,
      status: student.status,
      student_email: student.student_email,
    });
  }

  if (rowsToInsert.length) {
    const { data: insertedStudents, error } = await context.supabase
      .from("students")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      logImportFailure({
        context,
        error,
        operation: "students_insert",
      });
      return errorResult(
        "Students could not be imported. Please try again.",
        summary,
      );
    }

    summary.importedRows = insertedStudents?.length ?? rowsToInsert.length;
  }

  summary.skippedRows = skippedRows;
  revalidatePath("/dashboard/import");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/students");

  return successResult("Students imported.", summary);
}

export async function importBatchesFromCsv(
  csvText: string,
): Promise<ImportActionResult> {
  const context = await requireDashboardAccess();

  if (!canAccessPermission(context, "batches.create")) {
    return errorResult(
      "You do not have permission to import batches.",
      emptySummary(),
    );
  }

  if (!csvText || typeof csvText !== "string" || csvText.length > MAX_CSV_CHAR_LENGTH) {
    return errorResult(
      "CSV file size exceeds the 2MB limit. Please upload a smaller file.",
      emptySummary(),
    );
  }

  const parsed = parseCsv(csvText);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return errorResult(
      `CSV contains ${parsed.rows.length} rows. Maximum allowed per import is ${MAX_IMPORT_ROWS} rows.`,
      emptySummary(parsed.rows.length),
    );
  }
  const summary = emptySummary(parsed.rows.length);
  const errors: ImportRowIssue[] = [...parsed.errors];
  const missingColumns = getMissingColumns(parsed.headers, ["name"], context);

  for (const column of missingColumns) {
    errors.push({
      message: `Missing required column: ${column}.`,
      rowNumber: 1,
    });
  }

  const preparedBatches: Array<PreparedBatch & { rowNumber: number }> = [];

  for (const row of parsed.rows) {
    const name = rowValue(row.values, "name");
    const status = normalizeLookupValue(row.values.status) || "active";

    if (!name) {
      errors.push({ message: "name is required.", rowNumber: row.rowNumber });
      continue;
    }

    if (status !== "active") {
      errors.push({
        message: "Batch status must be active or blank.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const branchResult = resolveRowBranch({
      context,
      rowNumber: row.rowNumber,
      value: row.values.branch_name,
    });

    if (branchResult.error || !branchResult.branch) {
      errors.push(branchResult.error ?? {
        message: "Branch could not be resolved.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const permissionError = requireBranchPermissionForRow({
      branchId: branchResult.branch.id,
      context,
      permission: "batches.create",
      rowNumber: row.rowNumber,
    });

    if (permissionError) {
      errors.push(permissionError);
      continue;
    }

    preparedBatches.push({
      branch_id: branchResult.branch.id,
      institute_id: context.institute.id,
      name,
      rowNumber: row.rowNumber,
      subject: nullableRowValue(row.values, "subject"),
    });
  }

  if (errors.length) {
    return errorResult(
      IMPORT_FAILED_MESSAGE,
      withValidationErrors(summary, errors),
    );
  }

  if (!preparedBatches.length) {
    return errorResult("No valid batch rows were found.", summary);
  }

  const branchIds = Array.from(
    new Set(preparedBatches.map((batch) => batch.branch_id)),
  );
  const { data: existingRows, error: existingError } = await context.supabase
    .from("batches")
    .select("id, branch_id, name")
    .eq("institute_id", context.institute.id)
    .in("branch_id", branchIds);

  if (existingError) {
    logImportFailure({
      context,
      error: existingError,
      operation: "batches_duplicate_lookup",
    });
    return errorResult("Batches could not be imported. Please try again.", summary);
  }

  const existingKeys = new Set(
    ((existingRows ?? []) as ExistingBatch[]).map((batch) =>
      getBatchDuplicateKey(batch.branch_id, batch.name),
    ),
  );
  const csvKeys = new Set<string>();
  const rowsToInsert: PreparedBatch[] = [];
  let skippedRows = 0;

  for (const batch of preparedBatches) {
    const duplicateKey = getBatchDuplicateKey(batch.branch_id, batch.name);

    if (existingKeys.has(duplicateKey) || csvKeys.has(duplicateKey)) {
      skippedRows += 1;
      continue;
    }

    csvKeys.add(duplicateKey);
    rowsToInsert.push({
      branch_id: batch.branch_id,
      institute_id: batch.institute_id,
      name: batch.name,
      subject: batch.subject,
    });
  }

  if (rowsToInsert.length) {
    const { data: insertedBatches, error } = await context.supabase
      .from("batches")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      logImportFailure({
        context,
        error,
        operation: "batches_insert",
      });
      return errorResult(
        "Batches could not be imported. Please try again.",
        summary,
      );
    }

    summary.importedRows = insertedBatches?.length ?? rowsToInsert.length;
  }

  summary.skippedRows = skippedRows;
  revalidatePath("/dashboard/import");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/batches");

  return successResult("Batches imported.", summary);
}

export async function importStudentBatchAssignmentsFromCsv(
  csvText: string,
): Promise<ImportActionResult> {
  const context = await requireDashboardAccess();

  if (!requireAnyPermission(context, ["batches.update"])) {
    return errorResult(
      "You do not have permission to import student-batch assignments.",
      emptySummary(),
    );
  }

  if (!csvText || typeof csvText !== "string" || csvText.length > MAX_CSV_CHAR_LENGTH) {
    return errorResult(
      "CSV file size exceeds the 2MB limit. Please upload a smaller file.",
      emptySummary(),
    );
  }

  const parsed = parseCsv(csvText);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return errorResult(
      `CSV contains ${parsed.rows.length} rows. Maximum allowed per import is ${MAX_IMPORT_ROWS} rows.`,
      emptySummary(parsed.rows.length),
    );
  }
  const summary = emptySummary(parsed.rows.length);
  const errors: ImportRowIssue[] = [...parsed.errors];
  const missingColumns = getMissingColumns(
    parsed.headers,
    ["batch_name", "student_name"],
    context,
  );

  for (const column of missingColumns) {
    errors.push({
      message: `Missing required column: ${column}.`,
      rowNumber: 1,
    });
  }

  const branchByRowNumber = new Map<number, Branch>();

  for (const row of parsed.rows) {
    const studentName = rowValue(row.values, "student_name");
    const batchName = rowValue(row.values, "batch_name");

    if (!studentName) {
      errors.push({
        message: "student_name is required.",
        rowNumber: row.rowNumber,
      });
    }

    if (!batchName) {
      errors.push({
        message: "batch_name is required.",
        rowNumber: row.rowNumber,
      });
    }

    const branchResult = resolveRowBranch({
      context,
      rowNumber: row.rowNumber,
      value: row.values.branch_name,
    });

    if (branchResult.error || !branchResult.branch) {
      errors.push(branchResult.error ?? {
        message: "Branch could not be resolved.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    const permissionError = requireBranchPermissionForRow({
      branchId: branchResult.branch.id,
      context,
      permission: "batches.update",
      rowNumber: row.rowNumber,
    });

    if (permissionError) {
      errors.push(permissionError);
      continue;
    }

    branchByRowNumber.set(row.rowNumber, branchResult.branch);
  }

  if (errors.length) {
    return errorResult(
      IMPORT_FAILED_MESSAGE,
      withValidationErrors(summary, errors),
    );
  }

  const branchIds = Array.from(
    new Set(Array.from(branchByRowNumber.values()).map((branch) => branch.id)),
  );
  const [{ data: studentsData, error: studentsError }, { data: batchesData, error: batchesError }] =
    await Promise.all([
      context.supabase
        .from("students")
        .select("id, branch_id, full_name, phone, archived_at")
        .eq("institute_id", context.institute.id)
        .in("branch_id", branchIds),
      context.supabase
        .from("batches")
        .select("id, branch_id, name")
        .eq("institute_id", context.institute.id)
        .in("branch_id", branchIds),
    ]);

  if (studentsError || batchesError) {
    logImportFailure({
      context,
      error: studentsError ?? batchesError,
      operation: "assignment_lookup",
    });
    return errorResult(
      "Assignments could not be imported. Please try again.",
      summary,
    );
  }

  const students = (studentsData ?? []) as ExistingStudent[];
  const batches = (batchesData ?? []) as ExistingBatch[];
  const preparedAssignments: PreparedAssignment[] = [];

  for (const row of parsed.rows) {
    const branch = branchByRowNumber.get(row.rowNumber);

    if (!branch) {
      continue;
    }

    const studentName = rowValue(row.values, "student_name");
    const studentPhone = nullableRowValue(row.values, "student_phone");
    const batchName = rowValue(row.values, "batch_name");
    const studentMatches = students.filter(
      (student) =>
        student.branch_id === branch.id &&
        normalizeLookupValue(student.full_name) === normalizeLookupValue(studentName) &&
        (!studentPhone ||
          normalizeLookupValue(student.phone) === normalizeLookupValue(studentPhone)),
    );
    const batchMatches = batches.filter(
      (batch) =>
        batch.branch_id === branch.id &&
        normalizeLookupValue(batch.name) === normalizeLookupValue(batchName),
    );

    if (studentMatches.length === 0) {
      errors.push({
        message: "Matching active student was not found in this branch.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    if (studentMatches.length > 1) {
      errors.push({
        message: "Multiple students match this row. Add student_phone to identify one student.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    if (studentMatches[0].archived_at) {
      errors.push({
        message: "Archived students cannot be assigned to batches.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    if (batchMatches.length === 0) {
      errors.push({
        message: "Matching batch was not found in this branch.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    if (batchMatches.length > 1) {
      errors.push({
        message: "Multiple batches match this row. Use a unique batch name in the branch.",
        rowNumber: row.rowNumber,
      });
      continue;
    }

    preparedAssignments.push({
      batch_id: batchMatches[0].id,
      student_id: studentMatches[0].id,
    });
  }

  if (errors.length) {
    return errorResult(
      IMPORT_FAILED_MESSAGE,
      withValidationErrors(summary, errors),
    );
  }

  if (!preparedAssignments.length) {
    return errorResult("No valid assignment rows were found.", summary);
  }

  const batchIds = Array.from(
    new Set(preparedAssignments.map((assignment) => assignment.batch_id)),
  );
  const { data: existingAssignments, error: existingAssignmentsError } =
    await context.supabase
      .from("student_batches")
      .select("student_id, batch_id")
      .in("batch_id", batchIds);

  if (existingAssignmentsError) {
    logImportFailure({
      context,
      error: existingAssignmentsError,
      operation: "assignment_duplicate_lookup",
    });
    return errorResult(
      "Assignments could not be imported. Please try again.",
      summary,
    );
  }

  const existingKeys = new Set(
    ((existingAssignments ?? []) as ExistingStudentBatch[]).map(
      (assignment) => `${assignment.student_id}|${assignment.batch_id}`,
    ),
  );
  const csvKeys = new Set<string>();
  const rowsToInsert: PreparedAssignment[] = [];
  let skippedRows = 0;

  for (const assignment of preparedAssignments) {
    const duplicateKey = `${assignment.student_id}|${assignment.batch_id}`;

    if (existingKeys.has(duplicateKey) || csvKeys.has(duplicateKey)) {
      skippedRows += 1;
      continue;
    }

    csvKeys.add(duplicateKey);
    rowsToInsert.push(assignment);
  }

  if (rowsToInsert.length) {
    const { data: insertedAssignments, error } = await context.supabase
      .from("student_batches")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      logImportFailure({
        context,
        error,
        operation: "assignments_insert",
      });
      return errorResult(
        "Assignments could not be imported. Please try again.",
        summary,
      );
    }

    summary.importedRows = insertedAssignments?.length ?? rowsToInsert.length;
  }

  summary.skippedRows = skippedRows;
  revalidatePath("/dashboard/import");
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/homework");
  revalidatePath("/dashboard/tests");

  return successResult("Assignments imported.", summary);
}

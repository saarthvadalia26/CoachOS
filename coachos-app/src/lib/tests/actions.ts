"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { isDateValue } from "@/lib/dashboard/list-controls";

const TESTS_PATH = "/dashboard/tests";

const testStatuses = ["scheduled", "marks_entry", "completed", "archived"] as const;
type TestStatus = (typeof testStatuses)[number];

const scoreStatuses = ["not_entered", "present", "absent", "excused"] as const;
type ScoreStatus = (typeof scoreStatuses)[number];

type TestBatch = {
  branch_id: string;
  id: string;
  institute_id: string;
  name: string;
  subject: string | null;
};

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

function getSafeNextPath(formData: FormData, fallback = TESTS_PATH) {
  const next = String(formData.get("next") ?? "").trim();
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return fallback;
}

function redirectWith(path: string, key: "error" | "success", message: string): never {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);
  params.set(key, message);
  redirect(`${pathname}?${params.toString()}`);
}

function redirectWithError(message: string): never {
  redirectWith(TESTS_PATH, "error", message);
}

function redirectWithSaveError(path = TESTS_PATH): never {
  redirectWith(path, "error", "Could not save test. Please try again.");
}

function parseTestStatus(value: string | null, fallback: TestStatus): TestStatus {
  if (!value) return fallback;
  if (testStatuses.includes(value as TestStatus)) {
    return value as TestStatus;
  }
  redirectWithError("Select a valid test status.");
}

function parseScoreStatus(value: string | null, fallback: ScoreStatus): ScoreStatus {
  if (!value) return fallback;
  if (scoreStatuses.includes(value as ScoreStatus)) {
    return value as ScoreStatus;
  }
  redirectWithError("Select a valid score status.");
}

async function isTeacherAssignedToBatch(context: DashboardContext, batchId: string) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return false;
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("id")
    .eq("batch_id", batchId)
    .in("membership_id", teacherMembershipIds)
    .limit(1);

  if (error) {
    console.error("test teacher assignment check failed", error);
    return false;
  }

  return Boolean(data?.length);
}

async function canUseTestBatch(
  context: DashboardContext,
  batch: Pick<TestBatch, "branch_id" | "id">,
  permission: Permission,
) {
  if (context.role === "teacher") {
    if (!["tests.view", "tests.create", "tests.update", "tests.archive", "tests.delete"].includes(permission)) {
      return false;
    }
    return isTeacherAssignedToBatch(context, batch.id);
  }

  return canAccessPermission(context, permission, { branchId: batch.branch_id });
}

async function getBatchForTest(context: DashboardContext, batchId: string, permission: Permission) {
  const { data: batch, error } = await context.supabase
    .from("batches")
    .select("id, institute_id, branch_id, name, subject")
    .eq("id", batchId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error || !batch) {
    console.error("test batch lookup failed", error);
    redirectWithError("Select a batch from this institute.");
  }

  const testBatch = batch as TestBatch;

  if (!(await canUseTestBatch(context, testBatch, permission))) {
    redirectWithError("You do not have permission to perform this action.");
  }

  return testBatch;
}

async function getTestForAction(context: DashboardContext, testId: string, permission: Permission) {
  const { data: test, error } = await context.supabase
    .from("tests")
    .select("id, institute_id, branch_id, batch_id, status, max_marks")
    .eq("id", testId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error || !test) {
    console.error("test lookup failed", error);
    redirectWithError("Select a test from this institute.");
  }

  const { data: batch, error: batchError } = await context.supabase
    .from("batches")
    .select("id, institute_id, branch_id, name, subject")
    .eq("id", test.batch_id)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (batchError || !batch) {
    console.error("test batch lookup failed", batchError);
    redirectWithError("Select a test with a valid batch.");
  }

  const testBatch = batch as TestBatch;

  if (!(await canUseTestBatch(context, testBatch, permission))) {
    redirectWithError("You do not have permission to perform this action.");
  }

  return {
    batch: testBatch,
    test: test as {
      id: string;
      institute_id: string;
      branch_id: string;
      batch_id: string;
      status: TestStatus;
      max_marks: number;
    },
  };
}

// Helper to sync test scores for a batch
// Helper to sync test scores for a batch
export async function syncTestScoresForBatch(context: DashboardContext, testId: string): Promise<{ success: boolean; studentCount: number }> {
  console.log("syncTestScoresForBatch: starting sync for test ID:", testId);

  // 1. Fetch test details
  const { data: test, error: testError } = await context.supabase
    .from("tests")
    .select("id, institute_id, branch_id, batch_id")
    .eq("id", testId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (testError || !test) {
    console.error("syncTestScoresForBatch: test lookup failed:", { error: testError, testExists: !!test });
    return { success: false, studentCount: 0 };
  }
  console.log("syncTestScoresForBatch: test lookup succeeded:", test);

  // 2. Fetch all student IDs assigned to that batch
  const { data: studentBatchRows, error: studentBatchesError } = await context.supabase
    .from("student_batches")
    .select("student_id")
    .eq("batch_id", test.batch_id);

  if (studentBatchesError) {
    console.error("syncTestScoresForBatch: student_batches query failed:", studentBatchesError);
    return { success: false, studentCount: 0 };
  }
  console.log("syncTestScoresForBatch: student_batches query returned count:", studentBatchRows?.length ?? 0);

  const studentIds = (studentBatchRows ?? []).map((sb) => sb.student_id);
  if (!studentIds.length) {
    console.log("syncTestScoresForBatch: zero student IDs returned for batch");
    return { success: true, studentCount: 0 };
  }

  // 3. Filter for active, non-archived students
  console.log("syncTestScoresForBatch: querying students table for active batch students");
  const { data: activeStudents, error: studentsError } = await context.supabase
    .from("students")
    .select("id")
    .in("id", studentIds)
    .is("archived_at", null)
    .or("status.neq.archived,status.is.null");

  if (studentsError) {
    console.error("syncTestScoresForBatch: students lookup query failed:", studentsError);
    return { success: false, studentCount: 0 };
  }
  console.log("syncTestScoresForBatch: students lookup succeeded, active count:", activeStudents?.length ?? 0);

  const activeStudentIds = (activeStudents ?? []).map((s) => s.id);
  if (!activeStudentIds.length) {
    console.log("syncTestScoresForBatch: zero active non-archived students in batch");
    return { success: true, studentCount: 0 };
  }

  // 4. Fetch existing scores for this test
  const { data: existingScores, error: scoresError } = await context.supabase
    .from("test_scores")
    .select("student_id")
    .eq("test_id", testId);

  if (scoresError) {
    console.error("syncTestScoresForBatch: existing scores query failed:", scoresError);
    return { success: false, studentCount: activeStudentIds.length };
  }
  console.log("syncTestScoresForBatch: existing scores query returned count:", existingScores?.length ?? 0);

  const existingStudentIds = new Set((existingScores ?? []).map((es) => es.student_id));
  const missingStudentIds = activeStudentIds.filter((id) => !existingStudentIds.has(id));
  console.log("syncTestScoresForBatch: count of missing scores to insert:", missingStudentIds.length);

  // 5. Insert missing test score rows
  if (missingStudentIds.length > 0) {
    const rowsToInsert = missingStudentIds.map((studentId) => ({
      institute_id: test.institute_id,
      branch_id: test.branch_id,
      test_id: testId,
      student_id: studentId,
      status: "not_entered" as const,
    }));

    const { error: insertError } = await context.supabase
      .from("test_scores")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("syncTestScoresForBatch: test_scores insertion failed:", insertError);
      return { success: false, studentCount: activeStudentIds.length };
    }
    console.log("syncTestScoresForBatch: test_scores insertion succeeded");
  }

  return { success: true, studentCount: activeStudentIds.length };
}

export async function createTest(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const currentUserId = context.claims.sub;
  const resolvedRole = context.role;
  const resolvedInstituteId = context.institute?.id;
  const resolvedBranchId = context.branchId;

  console.log("createTest: execution started:", {
    currentUserId,
    resolvedRole,
    resolvedInstituteId,
    resolvedBranchId,
    formData: Object.fromEntries(formData.entries()),
  });

  const batchId = getRequiredText(formData, "batchId", "Batch");
  const requestedBranchId = getOptionalText(formData, "branchId");

  console.log("createTest: performing batch lookup and permission checks for batch ID:", batchId);
  const batch = await getBatchForTest(context, batchId, "tests.create");
  console.log("createTest: batch lookup and permission checks succeeded:", batch);

  if (requestedBranchId && requestedBranchId !== batch.branch_id) {
    console.error("createTest: branch mismatch:", { requestedBranchId, batchBranchId: batch.branch_id });
    redirectWith(next, "error", "Select a batch from the selected branch.");
  }

  const title = getRequiredText(formData, "title", "Test title");
  const subject = getOptionalText(formData, "subject") ?? batch.subject;
  const testDate = getRequiredText(formData, "testDate", "Test date");
  const maxMarksStr = getRequiredText(formData, "maxMarks", "Maximum marks");
  const description = getOptionalText(formData, "description");
  const status = parseTestStatus(getOptionalText(formData, "status"), "scheduled");

  console.log("createTest: validated basic payload details:", {
    title,
    subject,
    testDate,
    maxMarksStr,
    status,
  });

  if (!isDateValue(testDate)) {
    console.error("createTest: invalid testDate format:", testDate);
    redirectWith(next, "error", "Select a valid test date.");
  }

  const maxMarks = Number(maxMarksStr);
  if (isNaN(maxMarks) || maxMarks <= 0) {
    console.error("createTest: invalid maxMarks value:", maxMarksStr);
    redirectWith(next, "error", "Maximum marks must be greater than 0.");
  }

  console.log("createTest: inserting into tests table with derived values:", {
    batch_id: batch.id,
    branch_id: batch.branch_id,
    institute_id: batch.institute_id,
  });

  // Insert the test row
  const { data: newTest, error } = await context.supabase
    .from("tests")
    .insert({
      batch_id: batch.id,
      branch_id: batch.branch_id, // derived from batch
      created_by: currentUserId,
      description,
      institute_id: batch.institute_id, // derived from batch
      max_marks: maxMarks,
      status,
      subject,
      test_date: testDate,
      title,
    })
    .select("id")
    .maybeSingle();

  if (error || !newTest) {
    console.error("createTest: tests insertion failed:", error);
    redirectWithSaveError(next);
  }
  console.log("createTest: tests insertion succeeded, test ID:", newTest.id);

  // Automatically create test scores for active batch students
  const syncResult = await syncTestScoresForBatch(context, newTest.id);
  console.log("createTest: syncTestScoresForBatch result:", syncResult);

  revalidatePath(TESTS_PATH);
  revalidatePath("/dashboard");

  if (syncResult.success && syncResult.studentCount === 0) {
    console.log("createTest: success redirect with 0 active students message");
    redirectWith(next, "success", "Test created. No active students are assigned to this batch yet.");
  } else {
    console.log("createTest: success redirect");
    redirectWith(next, "success", "Test created.");
  }
}

export async function updateTest(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const testId = getRequiredText(formData, "testId", "Test");

  console.log("updateTest: execution started for test ID:", testId);
  const { batch: currentBatch, test } = await getTestForAction(context, testId, "tests.update");

  const requestedBatchId = getOptionalText(formData, "batchId");
  const nextBatch = requestedBatchId
    ? await getBatchForTest(context, requestedBatchId, "tests.update")
    : currentBatch;

  const requestedBranchId = getOptionalText(formData, "branchId");
  if (requestedBranchId && requestedBranchId !== nextBatch.branch_id) {
    console.error("updateTest: branch mismatch:", { requestedBranchId, batchBranchId: nextBatch.branch_id });
    redirectWith(next, "error", "Select a batch from the selected branch.");
  }

  const title = getRequiredText(formData, "title", "Test title");
  const subject = getOptionalText(formData, "subject") ?? nextBatch.subject;
  const testDate = getRequiredText(formData, "testDate", "Test date");
  const maxMarksStr = getRequiredText(formData, "maxMarks", "Maximum marks");
  const description = getOptionalText(formData, "description");
  const status = parseTestStatus(getOptionalText(formData, "status"), test.status);

  if (!isDateValue(testDate)) {
    redirectWith(next, "error", "Select a valid test date.");
  }

  const maxMarks = Number(maxMarksStr);
  if (isNaN(maxMarks) || maxMarks <= 0) {
    redirectWith(next, "error", "Maximum marks must be greater than 0.");
  }

  console.log("updateTest: updating tests table row");
  // Update the test
  const { error } = await context.supabase
    .from("tests")
    .update({
      batch_id: nextBatch.id,
      branch_id: nextBatch.branch_id,
      description,
      max_marks: maxMarks,
      status,
      subject,
      test_date: testDate,
      title,
    })
    .eq("id", testId)
    .eq("institute_id", context.institute.id);

  if (error) {
    console.error("updateTest failed", error);
    redirectWithSaveError(next);
  }

  // If batch was changed, sync scores for the new batch
  if (nextBatch.id !== currentBatch.id) {
    console.log("updateTest: batch changed, syncing test scores for new batch");
    await syncTestScoresForBatch(context, testId);
  }

  revalidatePath(TESTS_PATH);
  revalidatePath(`/dashboard/tests/${testId}`);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Test updated.");
}

export async function archiveTest(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const testId = getRequiredText(formData, "testId", "Test");

  await getTestForAction(context, testId, "tests.archive");

  const { error } = await context.supabase
    .from("tests")
    .update({ status: "archived" })
    .eq("id", testId)
    .eq("institute_id", context.institute.id);

  if (error) {
    console.error("archiveTest failed", error);
    redirectWith(next, "error", "Could not archive test. Please try again.");
  }

  revalidatePath(TESTS_PATH);
  revalidatePath(`/dashboard/tests/${testId}`);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Test archived.");
}

export async function deleteTest(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const testId = getRequiredText(formData, "testId", "Test");

  await getTestForAction(context, testId, "tests.delete");

  const { error } = await context.supabase
    .from("tests")
    .delete()
    .eq("id", testId)
    .eq("institute_id", context.institute.id);

  if (error) {
    console.error("deleteTest failed", error);
    redirectWith(next, "error", "Could not delete test. Please try again.");
  }

  revalidatePath(TESTS_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Test deleted.");
}

export async function updateTestScore(formData: FormData) {
  const context = await requireDashboardAccess();
  const testId = getRequiredText(formData, "testId", "Test");
  const studentId = getRequiredText(formData, "studentId", "Student");
  const next = getSafeNextPath(formData, `/dashboard/tests/${testId}`);

  // Fetch test to validate marks limit
  const { test } = await getTestForAction(context, testId, "tests.update");

  const status = parseScoreStatus(formData.get("status") as string, "not_entered");
  const remarks = getOptionalText(formData, "remarks");

  let marksObtained: number | null = null;
  if (status === "present") {
    const marksStr = String(formData.get("marksObtained") ?? "").trim();
    if (!marksStr) {
      redirectWith(next, "error", "Marks obtained is required for present status.");
    }
    marksObtained = Number(marksStr);
    if (isNaN(marksObtained) || marksObtained < 0) {
      redirectWith(next, "error", "Marks obtained cannot be negative.");
    }
    if (marksObtained > test.max_marks) {
      redirectWith(next, "error", `Marks obtained cannot exceed maximum marks of ${test.max_marks}.`);
    }
  }

  const { error } = await context.supabase
    .from("test_scores")
    .upsert({
      checked_at: new Date().toISOString(),
      checked_by: context.claims.sub,
      institute_id: context.institute.id,
      branch_id: test.branch_id,
      marks_obtained: marksObtained,
      remarks,
      status,
      student_id: studentId,
      test_id: testId,
    }, {
      onConflict: "test_id,student_id",
    });

  if (error) {
    console.error("updateTestScore failed", error);
    redirectWith(next, "error", "Could not save test score. Please try again.");
  }

  revalidatePath(`/dashboard/tests/${testId}`);
  redirectWith(next, "success", "Scores updated.");
}

export async function bulkUpdateTestScores(formData: FormData) {
  const context = await requireDashboardAccess();
  const testId = getRequiredText(formData, "testId", "Test");
  const next = getSafeNextPath(formData, `/dashboard/tests/${testId}`);

  // Fetch test to validate marks limit
  const { test } = await getTestForAction(context, testId, "tests.update");

  // Read all student score fields from formData
  // For each student, they will have status-<id>, marks-<id>, remarks-<id>
  const studentIds = Array.from(formData.keys())
    .filter((k) => k.startsWith("status-"))
    .map((k) => k.slice("status-".length));

  if (!studentIds.length) {
    redirectWith(next, "success", "No scores to update.");
  }

  const upserts = [];
  const checkedAt = new Date().toISOString();

  for (const studentId of studentIds) {
    const status = parseScoreStatus(formData.get(`status-${studentId}`) as string, "not_entered");
    const remarks = getOptionalText(formData, `remarks-${studentId}`);
    let marksObtained: number | null = null;

    if (status === "present") {
      const marksStr = String(formData.get(`marks-${studentId}`) ?? "").trim();
      if (!marksStr) {
        redirectWith(next, "error", "Marks obtained is required for present status.");
      }
      marksObtained = Number(marksStr);
      if (isNaN(marksObtained) || marksObtained < 0) {
        redirectWith(next, "error", "Marks obtained cannot be negative.");
      }
      if (marksObtained > test.max_marks) {
        redirectWith(next, "error", `Marks obtained cannot exceed maximum marks of ${test.max_marks}.`);
      }
    }

    upserts.push({
      checked_at: checkedAt,
      checked_by: context.claims.sub,
      institute_id: context.institute.id,
      branch_id: test.branch_id,
      marks_obtained: marksObtained,
      remarks,
      status,
      student_id: studentId,
      test_id: testId,
    });
  }

  const { error } = await context.supabase
    .from("test_scores")
    .upsert(upserts, {
      onConflict: "test_id,student_id",
    });

  if (error) {
    console.error("bulkUpdateTestScores failed", error);
    redirectWith(next, "error", "Could not save test scores. Please try again.");
  }

  revalidatePath(`/dashboard/tests/${testId}`);
  redirectWith(next, "success", "Scores updated.");
}

export async function syncTestScoresAction(formData: FormData) {
  const context = await requireDashboardAccess();
  const testId = getRequiredText(formData, "testId", "Test");
  const next = getSafeNextPath(formData, `/dashboard/tests/${testId}`);

  // Fetch test to validate access
  await getTestForAction(context, testId, "tests.update");

  const result = await syncTestScoresForBatch(context, testId);
  if (!result.success) {
    redirectWith(next, "error", "Could not sync students. Please try again.");
  }

  revalidatePath(`/dashboard/tests/${testId}`);
  redirectWith(next, "success", "Students synced.");
}

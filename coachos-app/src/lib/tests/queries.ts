import { requirePermission, type DashboardContext } from "@/lib/auth/permissions";
import {
  getPage,
  getPaginationRange,
  getSearchTerm,
  isDateValue,
} from "@/lib/dashboard/list-controls";

export const testStatuses = ["scheduled", "marks_entry", "completed", "archived"] as const;
export type TestStatus = (typeof testStatuses)[number];

export const scoreStatuses = ["not_entered", "present", "absent", "excused"] as const;
export type ScoreStatus = (typeof scoreStatuses)[number];

export type TestRow = {
  id: string;
  institute_id: string;
  branch_id: string;
  batch_id: string;
  title: string;
  subject: string | null;
  test_date: string;
  max_marks: number;
  status: TestStatus;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  batches: { name: string; subject: string | null } | null;
  branches: { name: string } | null;
  score_entered_count?: number;
  score_total_count?: number;
  average_score?: number | null;
};

export type TestScoreRow = {
  id: string;
  institute_id: string;
  branch_id: string;
  test_id: string;
  student_id: string;
  marks_obtained: number | null;
  status: ScoreStatus;
  remarks: string | null;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
  students: { full_name: string } | null;
  profiles?: { full_name: string | null } | null;
};

export type TestListParams = {
  batchId?: string;
  branchId?: string;
  status?: string;
  testDate?: string;
  page?: string;
  q?: string;
};

async function getTeacherAssignedBatchIds(context: DashboardContext) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("batch_id")
    .in("membership_id", teacherMembershipIds);

  if (error) {
    console.error("tests teacher batch list failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    return [];
  }

  return Array.from(
    new Set((data ?? []).map((row) => row.batch_id).filter(Boolean)),
  ) as string[];
}

async function getVisibleTestBatchIds(context: DashboardContext) {
  if (context.role === "teacher") {
    return getTeacherAssignedBatchIds(context);
  }

  return null;
}

export async function listTests(params: TestListParams) {
  const context = await requirePermission("tests.view");
  const { accessibleBranches, institute, role, supabase } = context;

  const selectedBranch = accessibleBranches.find(
    (branch) => branch.id === params.branchId,
  );
  const selectedBranchId =
    role === "owner" ? selectedBranch?.id ?? null : context.branchId;

  const selectedBatchId = String(params.batchId ?? "").trim() || null;
  const selectedStatus = testStatuses.includes(params.status as TestStatus)
    ? (params.status as TestStatus)
    : null;
  const selectedDate = isDateValue(params.testDate) ? params.testDate! : "";
  const searchTerm = getSearchTerm(params.q);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);

  const teacherBatchIds = await getVisibleTestBatchIds(context);
  const visibleBranchIds = selectedBranchId
    ? [selectedBranchId]
    : role === "owner"
      ? []
      : accessibleBranches.map((branch) => branch.id);

  const filters = {
    batchId: selectedBatchId,
    branchId: selectedBranchId,
    status: selectedStatus,
    testDate: selectedDate,
    q: searchTerm,
  };

  // Fetch batches allowed for current user & branch scoping
  let batchesQuery = supabase
    .from("batches")
    .select("id, branch_id, name, subject")
    .eq("institute_id", institute.id)
    .order("name", { ascending: true });

  if (selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", selectedBranchId);
  } else if (visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", visibleBranchIds);
  }

  if (teacherBatchIds) {
    if (!teacherBatchIds.length) {
      return {
        tests: [] as TestRow[],
        batches: [] as { id: string; branch_id: string; name: string; subject: string | null }[],
        context,
        filters,
        page,
        totalCount: 0,
      };
    }
    batchesQuery = batchesQuery.in("id", teacherBatchIds);
  }

  const { data: batchRows, error: batchesError } = await batchesQuery;
  if (batchesError) {
    console.error("listTests batches query failed", batchesError);
  }

  const batches = batchRows ?? [];
  const allowedBatchIds = batches.map((batch) => batch.id);

  if (!allowedBatchIds.length || (selectedBatchId && !allowedBatchIds.includes(selectedBatchId))) {
    return {
      tests: [] as TestRow[],
      batches,
      context,
      filters,
      page,
      totalCount: 0,
    };
  }

  // Build the main tests query
  let testsQuery = supabase
    .from("tests")
    .select(
      "id, institute_id, branch_id, batch_id, title, subject, test_date, max_marks, status, description, created_by, created_at, updated_at, batches(name, subject), branches(name)",
      { count: "exact" },
    )
    .eq("institute_id", institute.id)
    .in("batch_id", selectedBatchId ? [selectedBatchId] : allowedBatchIds)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (selectedBranchId) {
    testsQuery = testsQuery.eq("branch_id", selectedBranchId);
  } else if (visibleBranchIds.length) {
    testsQuery = testsQuery.in("branch_id", visibleBranchIds);
  }

  if (selectedStatus) {
    testsQuery = testsQuery.eq("status", selectedStatus);
  }

  if (selectedDate) {
    testsQuery = testsQuery.eq("test_date", selectedDate);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    testsQuery = testsQuery.or(
      `title.ilike.${searchPattern},subject.ilike.${searchPattern}`,
    );
  }

  const { data: testsData, count, error: testsError } = await testsQuery.range(
    paginationRange.from,
    paginationRange.to,
  );

  if (testsError) {
    console.error("listTests tests query failed", testsError);
  }

  const tests = (testsData ?? []) as unknown as TestRow[];

  // Fetch score entry progress for each test
  if (tests.length > 0) {
    const testIds = tests.map((t) => t.id);
    const { data: scoresData, error: scoresError } = await supabase
      .from("test_scores")
      .select("test_id, status, marks_obtained")
      .in("test_id", testIds);

    if (!scoresError && scoresData) {
      const progressMap = new Map<string, { entered: number; total: number; totalMarks: number; presentCount: number }>();
      for (const row of scoresData) {
        const stats = progressMap.get(row.test_id) ?? { entered: 0, total: 0, totalMarks: 0, presentCount: 0 };
        stats.total += 1;
        if (row.status !== "not_entered") {
          stats.entered += 1;
        }
        if (row.status === "present" && row.marks_obtained !== null) {
          stats.totalMarks += Number(row.marks_obtained);
          stats.presentCount += 1;
        }
        progressMap.set(row.test_id, stats);
      }

      for (const test of tests) {
        const stats = progressMap.get(test.id);
        if (stats) {
          test.score_entered_count = stats.entered;
          test.score_total_count = stats.total;
          test.average_score = stats.presentCount > 0 ? stats.totalMarks / stats.presentCount : null;
        } else {
          test.score_entered_count = 0;
          test.score_total_count = 0;
          test.average_score = null;
        }
      }
    }
  }

  return {
    tests,
    batches,
    context,
    filters,
    page,
    totalCount: count ?? 0,
  };
}

export async function getTestDetail(testId: string) {
  const context = await requirePermission("tests.view");
  const { institute, supabase } = context;

  const { data: testRow, error } = await supabase
    .from("tests")
    .select(
      "id, institute_id, branch_id, batch_id, title, subject, test_date, max_marks, status, description, created_by, created_at, updated_at, batches(name, subject), branches(name)",
    )
    .eq("id", testId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (error) {
    console.error("getTestDetail failed", error);
    return null;
  }

  return testRow as unknown as TestRow | null;
}

export async function listTestScores(testId: string) {
  const context = await requirePermission("tests.view");
  const { institute, supabase } = context;

  const { data: scoresData, error } = await supabase
    .from("test_scores")
    .select(
      "id, institute_id, branch_id, test_id, student_id, marks_obtained, status, remarks, checked_by, checked_at, created_at, updated_at, students(full_name)",
    )
    .eq("test_id", testId)
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listTestScores failed", error);
    return [];
  }

  const scores = (scoresData ?? []) as unknown as TestScoreRow[];

  // Also query checker names from profiles if possible
  const checkedByIds = Array.from(new Set(scores.map((s) => s.checked_by).filter(Boolean))) as string[];
  if (checkedByIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", checkedByIds);

    if (!profilesError && profiles) {
      const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));
      for (const score of scores) {
        if (score.checked_by) {
          score.profiles = { full_name: profileMap.get(score.checked_by) ?? null };
        }
      }
    }
  }

  return scores;
}

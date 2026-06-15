import {
  canAccessPermission,
  requireDashboardAccess,
  type AppRole,
  type DashboardContext,
} from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import { getSearchTerm, isDateValue } from "@/lib/dashboard/list-controls";
import { getFeeStatus, type FeeStatus } from "@/lib/fees/status";

export type ReportsSearchParams = {
  academicYearId?: string;
  batchId?: string;
  branchId?: string;
  endDate?: string;
  q?: string;
  startDate?: string;
  studentId?: string;
  subject?: string;
};

export type ReportAccess = {
  canExportAttendance: boolean;
  canExportBranchComparison: boolean;
  canExportFees: boolean;
  canExportStudentProgress: boolean;
  canExportTests: boolean;
  canViewAttendance: boolean;
  canViewBranchComparison: boolean;
  canViewFees: boolean;
  canViewStudentProgress: boolean;
  canViewTests: boolean;
};

export type ReportBranch = {
  id: string;
  name: string;
};

export type ReportBatch = {
  branch_id: string;
  id: string;
  name: string;
  subject: string | null;
};

export type ReportStudent = {
  branch_id: string;
  full_name: string;
  id: string;
  phone: string | null;
};

export type AcademicYearOption = {
  end_date: string;
  id: string;
  is_active: boolean | null;
  name: string;
  start_date: string;
};

export type FeeReportRow = {
  amountDue: number;
  amountPaid: number;
  branchName: string;
  dueDate: string | null;
  pendingAmount: number;
  status: FeeStatus;
  studentName: string;
  studentPhone: string | null;
};

export type FeeStudentPendingRow = {
  branchName: string;
  pendingAmount: number;
  studentId: string;
  studentName: string;
  studentPhone: string | null;
};

export type FeeReport = {
  paidCount: number;
  pendingCount: number;
  pendingStudents: FeeStudentPendingRow[];
  records: FeeReportRow[];
  totalCollected: number;
  totalDue: number;
  totalPending: number;
  totalRecords: number;
  overdueCount: number;
};

export type AttendanceBatchRow = {
  absent: number;
  batchId: string;
  batchName: string;
  branchName: string;
  late: number;
  percentage: number;
  present: number;
  total: number;
};

export type AttendanceStudentRow = {
  absent: number;
  branchName: string;
  late: number;
  percentage: number;
  present: number;
  studentId: string;
  studentName: string;
  total: number;
};

export type AttendanceReport = {
  batchRows: AttendanceBatchRow[];
  studentRows: AttendanceStudentRow[];
  totals: {
    absent: number;
    late: number;
    percentage: number;
    present: number;
    total: number;
  };
};

export type TestBatchRow = {
  averagePercentage: number;
  batchId: string;
  batchName: string;
  branchName: string;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  marksEntered: number;
  testsConducted: number;
  totalScores: number;
};

export type TestStudentRow = {
  averagePercentage: number;
  branchName: string;
  enteredScores: number;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  studentId: string;
  studentName: string;
  testsCount: number;
};

export type TestReport = {
  batchRows: TestBatchRow[];
  highestPercentage: number | null;
  lowestPercentage: number | null;
  marksEntered: number;
  studentRows: TestStudentRow[];
  testsConducted: number;
};

export type BranchComparisonRow = {
  activeBatches: number;
  activeStudents: number;
  attendancePercentage: number;
  branchId: string;
  branchName: string;
  collectedFees: number;
  homeworkAssigned: number;
  pendingFees: number;
  testsConducted: number;
};

export type StudentProgressReport = {
  attendance: {
    absent: number;
    late: number;
    percentage: number;
    present: number;
    total: number;
  };
  fees: {
    pendingAmount: number;
    totalDue: number;
    totalPaid: number;
  };
  homework: {
    assigned: number;
    checked: number;
    submitted: number;
  };
  recentAttendance: Array<{
    batchName: string;
    date: string;
    status: string;
  }>;
  recentHomework: Array<{
    status: string;
    title: string;
  }>;
  recentTests: Array<{
    percentage: number | null;
    status: string;
    title: string;
  }>;
  student: ReportStudent | null;
  tests: {
    averagePercentage: number;
    enteredScores: number;
  };
};

export type ReportsData = {
  access: ReportAccess;
  academicYears: AcademicYearOption[];
  attendanceReport: AttendanceReport | null;
  batches: ReportBatch[];
  branchComparison: BranchComparisonRow[] | null;
  branches: ReportBranch[];
  context: DashboardContext;
  feeReport: FeeReport | null;
  filters: {
    academicYearId: string;
    batchId: string;
    branchId: string;
    endDate: string;
    q: string;
    startDate: string;
    studentId: string;
    subject: string;
  };
  loadErrors: string[];
  selectedAcademicYear: AcademicYearOption | null;
  selectedStudent: ReportStudent | null;
  studentProgress: StudentProgressReport | null;
  students: ReportStudent[];
  subjectOptions: string[];
  testReport: TestReport | null;
};

type AttendanceSessionRow = {
  batch_id: string;
  branch_id: string;
  id: string;
  session_date: string;
};

type AttendanceRecordRow = {
  session_id: string;
  status: string;
  student_id: string;
};

type FeeRecordRow = {
  amount_due: number | string;
  amount_paid: number | string;
  branch_id: string;
  due_date: string | null;
  status: string | null;
  student_id: string;
};

type TestRow = {
  batch_id: string;
  branch_id: string;
  id: string;
  max_marks: number | string;
  subject: string | null;
  test_date: string;
  title: string;
};

type TestScoreRow = {
  marks_obtained: number | string | null;
  status: string;
  student_id: string;
  test_id: string;
};

type HomeworkRow = {
  batch_id: string;
  branch_id: string;
  id: string;
  title: string;
};

type HomeworkSubmissionRow = {
  homework_id: string;
  status: string;
  student_id: string;
};

const reportRolesWithFees: readonly AppRole[] = [
  "accountant",
  "branch_manager",
  "operations_staff",
  "owner",
];

const feeExportRoles: readonly AppRole[] = [
  "accountant",
  "branch_manager",
  "owner",
];

function toAmount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function getPercentage(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return roundPercentage((numerator / denominator) * 100);
}

function getMonthStartDate(dateValue: string) {
  return `${dateValue.slice(0, 8)}01`;
}

function createEmptyAttendanceCounts() {
  return {
    absent: 0,
    late: 0,
    present: 0,
    total: 0,
  };
}

function getAttendanceStatus(status: string | null | undefined) {
  if (status === "absent" || status === "late") {
    return status;
  }

  return "present";
}

function getVisibleBranchIds(
  context: DashboardContext,
  selectedBranchId: string | null,
) {
  if (selectedBranchId) {
    return [selectedBranchId];
  }

  if (context.branchScope === "all") {
    return context.accessibleBranches.map((branch) => branch.id);
  }

  return context.branchId ? [context.branchId] : [];
}

function getAccess(context: DashboardContext): ReportAccess {
  const canViewFees =
    reportRolesWithFees.includes(context.role) &&
    canAccessPermission(context, "fees.view");
  const canViewAttendance =
    context.role !== "accountant" &&
    canAccessPermission(context, "attendance.view");
  const canViewTests =
    context.role !== "accountant" &&
    canAccessPermission(context, "tests.view");
  const canViewStudentProgress =
    canAccessPermission(context, "students.view") &&
    (canViewFees ||
      canViewAttendance ||
      canViewTests ||
      canAccessPermission(context, "homework.view"));

  return {
    canExportAttendance: canViewAttendance,
    canExportBranchComparison: context.role === "owner",
    canExportFees:
      canViewFees &&
      feeExportRoles.includes(context.role) &&
      canAccessPermission(context, "fees.export"),
    canExportStudentProgress: canViewStudentProgress,
    canExportTests: canViewTests,
    canViewAttendance,
    canViewBranchComparison: context.role === "owner",
    canViewFees,
    canViewStudentProgress,
    canViewTests,
  };
}

function logReportError({
  context,
  error,
  queryName,
}: {
  context: DashboardContext;
  error: unknown;
  queryName: string;
}) {
  console.error("report data load failed", {
    error,
    instituteId: context.institute.id,
    queryName,
    role: context.role,
    userId: context.claims.sub,
  });
}

async function getTeacherBatchIds(context: DashboardContext) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return null;
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("batch_id")
    .in("membership_id", teacherMembershipIds);

  if (error) {
    logReportError({ context, error, queryName: "teacher_batches" });
    return [];
  }

  return Array.from(
    new Set((data ?? []).map((row) => row.batch_id).filter(Boolean)),
  ) as string[];
}

function getFilteredStudents({
  q,
  selectedStudentId,
  students,
}: {
  q: string;
  selectedStudentId: string;
  students: ReportStudent[];
}) {
  if (selectedStudentId) {
    return students.filter((student) => student.id === selectedStudentId);
  }

  if (!q) {
    return students;
  }

  const lookup = q.toLowerCase();

  return students.filter(
    (student) =>
      student.full_name.toLowerCase().includes(lookup) ||
      (student.phone ?? "").toLowerCase().includes(lookup),
  );
}

function getSubjectOptions(tests: readonly TestRow[], batches: readonly ReportBatch[]) {
  const subjects = new Set<string>();

  for (const batch of batches) {
    if (batch.subject?.trim()) {
      subjects.add(batch.subject.trim());
    }
  }

  for (const test of tests) {
    if (test.subject?.trim()) {
      subjects.add(test.subject.trim());
    }
  }

  return Array.from(subjects).sort((first, second) =>
    first.localeCompare(second),
  );
}

function buildFeeReport({
  branchesById,
  feeRecords,
  studentsById,
  todayDate,
}: {
  branchesById: Map<string, ReportBranch>;
  feeRecords: FeeRecordRow[];
  studentsById: Map<string, ReportStudent>;
  todayDate: string;
}): FeeReport {
  const records = feeRecords.map((record) => {
    const amountDue = toAmount(record.amount_due);
    const amountPaid = toAmount(record.amount_paid);
    const status = getFeeStatus({
      amountDue,
      amountPaid,
      dueDate: record.due_date,
      status: record.status,
      todayDate,
    });
    const student = studentsById.get(record.student_id);
    const branch = branchesById.get(record.branch_id);

    return {
      amountDue,
      amountPaid,
      branchName: branch?.name ?? "Branch",
      dueDate: record.due_date,
      pendingAmount: Math.max(amountDue - amountPaid, 0),
      status,
      studentName: student?.full_name ?? "Student",
      studentPhone: student?.phone ?? null,
    };
  });
  const pendingByStudent = new Map<string, FeeStudentPendingRow>();

  for (const record of feeRecords) {
    const amountDue = toAmount(record.amount_due);
    const amountPaid = toAmount(record.amount_paid);
    const pendingAmount = Math.max(amountDue - amountPaid, 0);

    if (pendingAmount <= 0) {
      continue;
    }

    const student = studentsById.get(record.student_id);
    const existing = pendingByStudent.get(record.student_id);

    pendingByStudent.set(record.student_id, {
      branchName: branchesById.get(record.branch_id)?.name ?? "Branch",
      pendingAmount: (existing?.pendingAmount ?? 0) + pendingAmount,
      studentId: record.student_id,
      studentName: student?.full_name ?? "Student",
      studentPhone: student?.phone ?? null,
    });
  }

  return {
    overdueCount: records.filter((record) => record.status === "overdue").length,
    paidCount: records.filter((record) => record.status === "paid").length,
    pendingCount: records.filter((record) => record.status !== "paid").length,
    pendingStudents: Array.from(pendingByStudent.values()).sort(
      (first, second) => second.pendingAmount - first.pendingAmount,
    ),
    records,
    totalCollected: records.reduce(
      (total, record) => total + record.amountPaid,
      0,
    ),
    totalDue: records.reduce((total, record) => total + record.amountDue, 0),
    totalPending: records.reduce(
      (total, record) => total + record.pendingAmount,
      0,
    ),
    totalRecords: records.length,
  };
}

function buildAttendanceReport({
  attendanceRecords,
  batchesById,
  branchesById,
  filteredStudentIds,
  sessions,
  studentsById,
}: {
  attendanceRecords: AttendanceRecordRow[];
  batchesById: Map<string, ReportBatch>;
  branchesById: Map<string, ReportBranch>;
  filteredStudentIds: Set<string>;
  sessions: AttendanceSessionRow[];
  studentsById: Map<string, ReportStudent>;
}): AttendanceReport {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const batchCounts = new Map<string, ReturnType<typeof createEmptyAttendanceCounts>>();
  const studentCounts = new Map<string, ReturnType<typeof createEmptyAttendanceCounts>>();
  const totals = createEmptyAttendanceCounts();

  for (const record of attendanceRecords) {
    const session = sessionsById.get(record.session_id);

    if (!session) {
      continue;
    }

    const status = getAttendanceStatus(record.status);
    const batchStats = batchCounts.get(session.batch_id) ?? createEmptyAttendanceCounts();
    batchStats[status] += 1;
    batchStats.total += 1;
    batchCounts.set(session.batch_id, batchStats);

    totals[status] += 1;
    totals.total += 1;

    if (filteredStudentIds.has(record.student_id)) {
      const studentStats =
        studentCounts.get(record.student_id) ?? createEmptyAttendanceCounts();
      studentStats[status] += 1;
      studentStats.total += 1;
      studentCounts.set(record.student_id, studentStats);
    }
  }

  return {
    batchRows: Array.from(batchCounts.entries())
      .map(([batchId, counts]) => {
        const batch = batchesById.get(batchId);

        return {
          absent: counts.absent,
          batchId,
          batchName: batch?.name ?? "Batch",
          branchName: batch ? branchesById.get(batch.branch_id)?.name ?? "Branch" : "Branch",
          late: counts.late,
          percentage: getPercentage(counts.present + counts.late, counts.total),
          present: counts.present,
          total: counts.total,
        };
      })
      .sort((first, second) => second.percentage - first.percentage),
    studentRows: Array.from(studentCounts.entries())
      .map(([studentId, counts]) => {
        const student = studentsById.get(studentId);

        return {
          absent: counts.absent,
          branchName: student ? branchesById.get(student.branch_id)?.name ?? "Branch" : "Branch",
          late: counts.late,
          percentage: getPercentage(counts.present + counts.late, counts.total),
          present: counts.present,
          studentId,
          studentName: student?.full_name ?? "Student",
          total: counts.total,
        };
      })
      .sort((first, second) => first.studentName.localeCompare(second.studentName)),
    totals: {
      absent: totals.absent,
      late: totals.late,
      percentage: getPercentage(totals.present + totals.late, totals.total),
      present: totals.present,
      total: totals.total,
    },
  };
}

function scorePercentage(score: TestScoreRow, test: TestRow | undefined) {
  if (!test || score.status !== "present" || score.marks_obtained === null) {
    return null;
  }

  const maxMarks = toAmount(test.max_marks);

  if (maxMarks <= 0) {
    return null;
  }

  return (toAmount(score.marks_obtained) / maxMarks) * 100;
}

function average(values: readonly number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildTestReport({
  batchesById,
  branchesById,
  filteredStudentIds,
  scores,
  studentsById,
  tests,
}: {
  batchesById: Map<string, ReportBatch>;
  branchesById: Map<string, ReportBranch>;
  filteredStudentIds: Set<string>;
  scores: TestScoreRow[];
  studentsById: Map<string, ReportStudent>;
  tests: TestRow[];
}): TestReport {
  const testsById = new Map(tests.map((test) => [test.id, test]));
  const scoresByBatch = new Map<string, number[]>();
  const enteredScoresByBatch = new Map<string, number>();
  const totalScoresByBatch = new Map<string, number>();
  const scoresByStudent = new Map<string, number[]>();
  const enteredScoresByStudent = new Map<string, number>();
  const allPercentages: number[] = [];
  let marksEntered = 0;

  for (const score of scores) {
    const test = testsById.get(score.test_id);

    if (!test) {
      continue;
    }

    const totalScores = totalScoresByBatch.get(test.batch_id) ?? 0;
    totalScoresByBatch.set(test.batch_id, totalScores + 1);

    if (score.status !== "not_entered") {
      marksEntered += 1;
      enteredScoresByBatch.set(
        test.batch_id,
        (enteredScoresByBatch.get(test.batch_id) ?? 0) + 1,
      );

      if (filteredStudentIds.has(score.student_id)) {
        enteredScoresByStudent.set(
          score.student_id,
          (enteredScoresByStudent.get(score.student_id) ?? 0) + 1,
        );
      }
    }

    const percentage = scorePercentage(score, test);

    if (percentage === null) {
      continue;
    }

    allPercentages.push(percentage);
    scoresByBatch.set(test.batch_id, [
      ...(scoresByBatch.get(test.batch_id) ?? []),
      percentage,
    ]);

    if (filteredStudentIds.has(score.student_id)) {
      scoresByStudent.set(score.student_id, [
        ...(scoresByStudent.get(score.student_id) ?? []),
        percentage,
      ]);
    }
  }

  const testsByBatch = new Map<string, TestRow[]>();

  for (const test of tests) {
    testsByBatch.set(test.batch_id, [
      ...(testsByBatch.get(test.batch_id) ?? []),
      test,
    ]);
  }

  return {
    batchRows: Array.from(testsByBatch.entries())
      .map(([batchId, batchTests]) => {
        const percentages = scoresByBatch.get(batchId) ?? [];
        const batch = batchesById.get(batchId);

        return {
          averagePercentage: roundPercentage(average(percentages)),
          batchId,
          batchName: batch?.name ?? "Batch",
          branchName: batch ? branchesById.get(batch.branch_id)?.name ?? "Branch" : "Branch",
          highestPercentage: percentages.length ? roundPercentage(Math.max(...percentages)) : null,
          lowestPercentage: percentages.length ? roundPercentage(Math.min(...percentages)) : null,
          marksEntered: enteredScoresByBatch.get(batchId) ?? 0,
          testsConducted: batchTests.length,
          totalScores: totalScoresByBatch.get(batchId) ?? 0,
        };
      })
      .sort((first, second) => first.batchName.localeCompare(second.batchName)),
    highestPercentage: allPercentages.length
      ? roundPercentage(Math.max(...allPercentages))
      : null,
    lowestPercentage: allPercentages.length
      ? roundPercentage(Math.min(...allPercentages))
      : null,
    marksEntered,
    studentRows: Array.from(scoresByStudent.entries())
      .map(([studentId, percentages]) => {
        const student = studentsById.get(studentId);

        return {
          averagePercentage: roundPercentage(average(percentages)),
          branchName: student ? branchesById.get(student.branch_id)?.name ?? "Branch" : "Branch",
          enteredScores: enteredScoresByStudent.get(studentId) ?? 0,
          highestPercentage: percentages.length ? roundPercentage(Math.max(...percentages)) : null,
          lowestPercentage: percentages.length ? roundPercentage(Math.min(...percentages)) : null,
          studentId,
          studentName: student?.full_name ?? "Student",
          testsCount: percentages.length,
        };
      })
      .sort((first, second) => second.averagePercentage - first.averagePercentage),
    testsConducted: tests.length,
  };
}

function buildBranchComparison({
  attendanceReport,
  batches,
  branches,
  feeRecords,
  homeworkAssignments,
  students,
  tests,
}: {
  attendanceReport: AttendanceReport | null;
  batches: ReportBatch[];
  branches: ReportBranch[];
  feeRecords: FeeRecordRow[];
  homeworkAssignments: HomeworkRow[];
  students: ReportStudent[];
  tests: TestRow[];
}): BranchComparisonRow[] {
  const attendanceByBatch = new Map(
    (attendanceReport?.batchRows ?? []).map((row) => [row.batchId, row]),
  );

  return branches.map((branch) => {
    const branchBatches = batches.filter((batch) => batch.branch_id === branch.id);
    const attendanceCounts = branchBatches.reduce(
      (counts, batch) => {
        const row = attendanceByBatch.get(batch.id);

        if (!row) {
          return counts;
        }

        counts.present += row.present;
        counts.late += row.late;
        counts.total += row.total;

        return counts;
      },
      { late: 0, present: 0, total: 0 },
    );
    const branchFees = feeRecords.filter((record) => record.branch_id === branch.id);

    return {
      activeBatches: branchBatches.length,
      activeStudents: students.filter((student) => student.branch_id === branch.id).length,
      attendancePercentage: getPercentage(
        attendanceCounts.present + attendanceCounts.late,
        attendanceCounts.total,
      ),
      branchId: branch.id,
      branchName: branch.name,
      collectedFees: branchFees.reduce(
        (total, record) => total + toAmount(record.amount_paid),
        0,
      ),
      homeworkAssigned: homeworkAssignments.filter(
        (homework) => homework.branch_id === branch.id,
      ).length,
      pendingFees: branchFees.reduce(
        (total, record) =>
          total +
          Math.max(toAmount(record.amount_due) - toAmount(record.amount_paid), 0),
        0,
      ),
      testsConducted: tests.filter((test) => test.branch_id === branch.id).length,
    };
  });
}

function buildStudentProgress({
  attendanceRecords,
  feeRecords,
  homeworkAssignmentsById,
  homeworkSubmissions,
  selectedStudent,
  sessionsById,
  testScores,
  testsById,
  batchesById,
}: {
  attendanceRecords: AttendanceRecordRow[];
  batchesById: Map<string, ReportBatch>;
  feeRecords: FeeRecordRow[];
  homeworkAssignmentsById: Map<string, HomeworkRow>;
  homeworkSubmissions: HomeworkSubmissionRow[];
  selectedStudent: ReportStudent | null;
  sessionsById: Map<string, AttendanceSessionRow>;
  testScores: TestScoreRow[];
  testsById: Map<string, TestRow>;
}): StudentProgressReport | null {
  if (!selectedStudent) {
    return null;
  }

  const attendanceCounts = createEmptyAttendanceCounts();
  const studentAttendance = attendanceRecords.filter(
    (record) => record.student_id === selectedStudent.id,
  );

  for (const record of studentAttendance) {
    const status = getAttendanceStatus(record.status);
    attendanceCounts[status] += 1;
    attendanceCounts.total += 1;
  }

  const studentFees = feeRecords.filter(
    (record) => record.student_id === selectedStudent.id,
  );
  const studentHomework = homeworkSubmissions.filter(
    (submission) => submission.student_id === selectedStudent.id,
  );
  const studentScores = testScores.filter(
    (score) => score.student_id === selectedStudent.id,
  );
  const percentages = studentScores
    .map((score) => scorePercentage(score, testsById.get(score.test_id)))
    .filter((value): value is number => value !== null);

  return {
    attendance: {
      absent: attendanceCounts.absent,
      late: attendanceCounts.late,
      percentage: getPercentage(
        attendanceCounts.present + attendanceCounts.late,
        attendanceCounts.total,
      ),
      present: attendanceCounts.present,
      total: attendanceCounts.total,
    },
    fees: {
      pendingAmount: studentFees.reduce(
        (total, record) =>
          total +
          Math.max(toAmount(record.amount_due) - toAmount(record.amount_paid), 0),
        0,
      ),
      totalDue: studentFees.reduce(
        (total, record) => total + toAmount(record.amount_due),
        0,
      ),
      totalPaid: studentFees.reduce(
        (total, record) => total + toAmount(record.amount_paid),
        0,
      ),
    },
    homework: {
      assigned: studentHomework.length,
      checked: studentHomework.filter((submission) => submission.status === "checked").length,
      submitted: studentHomework.filter((submission) =>
        ["checked", "late", "submitted"].includes(submission.status),
      ).length,
    },
    recentAttendance: studentAttendance.slice(0, 8).map((record) => {
      const session = sessionsById.get(record.session_id);
      const batch = session ? batchesById.get(session.batch_id) : null;

      return {
        batchName: batch?.name ?? "Batch",
        date: session?.session_date ?? "",
        status: getAttendanceStatus(record.status),
      };
    }),
    recentHomework: studentHomework.slice(0, 8).map((submission) => ({
      status: submission.status,
      title: homeworkAssignmentsById.get(submission.homework_id)?.title ?? "Homework",
    })),
    recentTests: studentScores.slice(0, 8).map((score) => ({
      percentage: scorePercentage(score, testsById.get(score.test_id)),
      status: score.status,
      title: testsById.get(score.test_id)?.title ?? "Test",
    })),
    student: selectedStudent,
    tests: {
      averagePercentage: roundPercentage(average(percentages)),
      enteredScores: studentScores.filter((score) => score.status !== "not_entered").length,
    },
  };
}

export async function getReportsData(
  params: ReportsSearchParams,
): Promise<ReportsData> {
  const context = await requireDashboardAccess();
  const access = getAccess(context);
  const loadErrors: string[] = [];

  if (
    !access.canViewAttendance &&
    !access.canViewBranchComparison &&
    !access.canViewFees &&
    !access.canViewStudentProgress &&
    !access.canViewTests
  ) {
    return {
      access,
      academicYears: [],
      attendanceReport: null,
      batches: [],
      branchComparison: null,
      branches: [],
      context,
      feeReport: null,
      filters: {
        academicYearId: "",
        batchId: "",
        branchId: "",
        endDate: "",
        q: "",
        startDate: "",
        studentId: "",
        subject: "",
      },
      loadErrors: ["You do not have permission to view reports."],
      selectedAcademicYear: null,
      selectedStudent: null,
      studentProgress: null,
      students: [],
      subjectOptions: [],
      testReport: null,
    };
  }

  const branchScope = getBranchScope(context, params.branchId);
  const visibleBranchIds = getVisibleBranchIds(
    context,
    branchScope.selectedBranchId,
  );
  const branches = context.accessibleBranches
    .filter((branch) => visibleBranchIds.includes(branch.id))
    .map((branch) => ({ id: branch.id, name: branch.name }));
  const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
  const todayDate = getTodayDateValue();
  const q = getSearchTerm(params.q);
  const selectedSubject = String(params.subject ?? "").trim();

  const { data: academicYearRows, error: academicYearsError } =
    await context.supabase
      .from("academic_years")
      .select("id, name, start_date, end_date, is_active")
      .eq("institute_id", context.institute.id)
      .order("start_date", { ascending: false });

  if (academicYearsError) {
    logReportError({ context, error: academicYearsError, queryName: "academic_years" });
    loadErrors.push("Academic year filters are unavailable right now.");
  }

  const academicYears = (academicYearRows ?? []) as AcademicYearOption[];
  const selectedAcademicYear =
    academicYears.find((academicYear) => academicYear.id === params.academicYearId) ??
    null;
  const startDate = isDateValue(params.startDate)
    ? params.startDate!
    : selectedAcademicYear?.start_date ?? getMonthStartDate(todayDate);
  const endDate = isDateValue(params.endDate)
    ? params.endDate!
    : selectedAcademicYear?.end_date ?? todayDate;

  const teacherBatchIds = await getTeacherBatchIds(context);
  let batchesQuery = context.supabase
    .from("batches")
    .select("id, branch_id, name, subject")
    .eq("institute_id", context.institute.id)
    .order("name", { ascending: true });

  if (visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", visibleBranchIds);
  }

  if (teacherBatchIds) {
    batchesQuery = teacherBatchIds.length
      ? batchesQuery.in("id", teacherBatchIds)
      : batchesQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: batchRows, error: batchesError } = await batchesQuery;

  if (batchesError) {
    logReportError({ context, error: batchesError, queryName: "batches" });
    loadErrors.push("Batch filters are unavailable right now.");
  }

  const batches = (batchRows ?? []) as ReportBatch[];
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const selectedBatch = batches.find((batch) => batch.id === params.batchId) ?? null;
  const reportBatchIds = selectedBatch
    ? [selectedBatch.id]
    : batches.map((batch) => batch.id);

  let studentRows: ReportStudent[] = [];

  if (visibleBranchIds.length) {
    let studentsQuery = context.supabase
      .from("students")
      .select("id, branch_id, full_name, phone")
      .eq("institute_id", context.institute.id)
      .is("archived_at", null)
      .in("branch_id", visibleBranchIds)
      .order("full_name", { ascending: true });

    if (teacherBatchIds) {
      const { data: studentBatchRows, error: teacherStudentBatchError } =
        await context.supabase
          .from("student_batches")
          .select("student_id")
          .in(
            "batch_id",
            reportBatchIds.length
              ? reportBatchIds
              : ["00000000-0000-0000-0000-000000000000"],
          );

      if (teacherStudentBatchError) {
        logReportError({
          context,
          error: teacherStudentBatchError,
          queryName: "teacher_student_batches",
        });
        loadErrors.push("Student filters are unavailable right now.");
      }

      const teacherStudentIds = Array.from(
        new Set((studentBatchRows ?? []).map((row) => row.student_id).filter(Boolean)),
      );

      studentsQuery = teacherStudentIds.length
        ? studentsQuery.in("id", teacherStudentIds)
        : studentsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: studentsData, error: studentsError } = await studentsQuery;

    if (studentsError) {
      logReportError({ context, error: studentsError, queryName: "students" });
      loadErrors.push("Student filters are unavailable right now.");
    }

    studentRows = (studentsData ?? []) as ReportStudent[];
  }

  const filteredStudents = getFilteredStudents({
    q,
    selectedStudentId: String(params.studentId ?? ""),
    students: studentRows,
  });
  const selectedStudent =
    studentRows.find((student) => student.id === params.studentId) ?? null;
  const filteredStudentIds = new Set(filteredStudents.map((student) => student.id));
  const studentsById = new Map(studentRows.map((student) => [student.id, student]));

  let feeRecords: FeeRecordRow[] = [];

  if (access.canViewFees && visibleBranchIds.length) {
    let feeQuery = context.supabase
      .from("fee_records")
      .select("branch_id, student_id, amount_due, amount_paid, due_date, status")
      .eq("institute_id", context.institute.id)
      .in("branch_id", visibleBranchIds)
      .gte("due_date", startDate)
      .lte("due_date", endDate)
      .limit(5000);

    if (filteredStudentIds.size) {
      feeQuery = feeQuery.in("student_id", Array.from(filteredStudentIds));
    } else if (q || params.studentId) {
      feeQuery = feeQuery.eq("student_id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await feeQuery;

    if (error) {
      logReportError({ context, error, queryName: "fee_records" });
      loadErrors.push("Fee reports are unavailable right now.");
    }

    feeRecords = (data ?? []) as FeeRecordRow[];
  }

  let sessions: AttendanceSessionRow[] = [];
  let attendanceRecords: AttendanceRecordRow[] = [];

  if (access.canViewAttendance && reportBatchIds.length && visibleBranchIds.length) {
    let sessionsQuery = context.supabase
      .from("attendance_sessions")
      .select("id, branch_id, batch_id, session_date")
      .eq("institute_id", context.institute.id)
      .in("branch_id", visibleBranchIds)
      .in("batch_id", reportBatchIds)
      .gte("session_date", startDate)
      .lte("session_date", endDate)
      .limit(5000);

    if (selectedAcademicYear) {
      sessionsQuery = sessionsQuery.eq("academic_year_id", selectedAcademicYear.id);
    }

    const { data, error } = await sessionsQuery.order("session_date", {
      ascending: false,
    });

    if (error) {
      logReportError({ context, error, queryName: "attendance_sessions" });
      loadErrors.push("Attendance reports are unavailable right now.");
    }

    sessions = (data ?? []) as AttendanceSessionRow[];

    if (sessions.length) {
      const { data: recordRows, error: recordsError } = await context.supabase
        .from("attendance_records")
        .select("session_id, student_id, status")
        .in("session_id", sessions.map((session) => session.id));

      if (recordsError) {
        logReportError({ context, error: recordsError, queryName: "attendance_records" });
        loadErrors.push("Attendance records are unavailable right now.");
      }

      attendanceRecords = (recordRows ?? []) as AttendanceRecordRow[];
    }
  }

  let tests: TestRow[] = [];
  let testScores: TestScoreRow[] = [];

  if (access.canViewTests && reportBatchIds.length && visibleBranchIds.length) {
    let testsQuery = context.supabase
      .from("tests")
      .select("id, branch_id, batch_id, title, subject, test_date, max_marks")
      .eq("institute_id", context.institute.id)
      .in("branch_id", visibleBranchIds)
      .in("batch_id", reportBatchIds)
      .gte("test_date", startDate)
      .lte("test_date", endDate)
      .limit(5000);

    if (selectedSubject) {
      testsQuery = testsQuery.eq("subject", selectedSubject);
    }

    const { data, error } = await testsQuery.order("test_date", {
      ascending: false,
    });

    if (error) {
      logReportError({ context, error, queryName: "tests" });
      loadErrors.push("Test reports are unavailable right now.");
    }

    tests = (data ?? []) as TestRow[];

    if (tests.length) {
      const { data: scores, error: scoresError } = await context.supabase
        .from("test_scores")
        .select("test_id, student_id, marks_obtained, status")
        .in("test_id", tests.map((test) => test.id));

      if (scoresError) {
        logReportError({ context, error: scoresError, queryName: "test_scores" });
        loadErrors.push("Test score reports are unavailable right now.");
      }

      testScores = (scores ?? []) as TestScoreRow[];
    }
  }

  let homeworkAssignments: HomeworkRow[] = [];
  let homeworkSubmissions: HomeworkSubmissionRow[] = [];

  if (
    (access.canViewBranchComparison || access.canViewStudentProgress) &&
    canAccessPermission(context, "homework.view") &&
    reportBatchIds.length &&
    visibleBranchIds.length
  ) {
    const { data, error } = await context.supabase
      .from("homework_assignments")
      .select("id, branch_id, batch_id, title")
      .eq("institute_id", context.institute.id)
      .in("branch_id", visibleBranchIds)
      .in("batch_id", reportBatchIds)
      .gte("created_at", `${startDate}T00:00:00+00:00`)
      .lte("created_at", `${endDate}T23:59:59+00:00`)
      .limit(5000);

    if (error) {
      logReportError({ context, error, queryName: "homework_assignments" });
      loadErrors.push("Homework reports are unavailable right now.");
    }

    homeworkAssignments = (data ?? []) as HomeworkRow[];

    if (homeworkAssignments.length) {
      const { data: submissions, error: submissionsError } =
        await context.supabase
          .from("homework_submissions")
          .select("homework_id, student_id, status")
          .in("homework_id", homeworkAssignments.map((homework) => homework.id));

      if (submissionsError) {
        logReportError({ context, error: submissionsError, queryName: "homework_submissions" });
        loadErrors.push("Homework submission reports are unavailable right now.");
      }

      homeworkSubmissions = (submissions ?? []) as HomeworkSubmissionRow[];
    }
  }

  const attendanceReport = access.canViewAttendance
    ? buildAttendanceReport({
        attendanceRecords,
        batchesById,
        branchesById,
        filteredStudentIds,
        sessions,
        studentsById,
      })
    : null;
  const feeReport = access.canViewFees
    ? buildFeeReport({
        branchesById,
        feeRecords,
        studentsById,
        todayDate,
      })
    : null;
  const testReport = access.canViewTests
    ? buildTestReport({
        batchesById,
        branchesById,
        filteredStudentIds,
        scores: testScores,
        studentsById,
        tests,
      })
    : null;
  const homeworkAssignmentsById = new Map(
    homeworkAssignments.map((homework) => [homework.id, homework]),
  );
  const testsById = new Map(tests.map((test) => [test.id, test]));
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const branchComparison = access.canViewBranchComparison
    ? buildBranchComparison({
        attendanceReport,
        batches,
        branches,
        feeRecords,
        homeworkAssignments,
        students: studentRows,
        tests,
      })
    : null;
  const studentProgress = access.canViewStudentProgress
    ? buildStudentProgress({
        attendanceRecords,
        batchesById,
        feeRecords,
        homeworkAssignmentsById,
        homeworkSubmissions,
        selectedStudent,
        sessionsById,
        testScores,
        testsById,
      })
    : null;

  return {
    access,
    academicYears,
    attendanceReport,
    batches,
    branchComparison,
    branches,
    context,
    feeReport,
    filters: {
      academicYearId: selectedAcademicYear?.id ?? "",
      batchId: selectedBatch?.id ?? "",
      branchId: branchScope.selectedBranchId ?? "",
      endDate,
      q,
      startDate,
      studentId: selectedStudent?.id ?? "",
      subject: selectedSubject,
    },
    loadErrors,
    selectedAcademicYear,
    selectedStudent,
    studentProgress,
    students: filteredStudents,
    subjectOptions: getSubjectOptions(tests, batches),
    testReport,
  };
}

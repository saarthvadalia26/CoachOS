import { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";

export const dynamic = "force-dynamic";

type Batch = {
  branch_id: string;
  id: string;
  name: string;
};

type StudentBatch = {
  student_id: string;
};

type Student = {
  branch_id: string | null;
  full_name: string;
  id: string;
  phone: string | null;
};

type AcademicYear = {
  end_date: string;
  id: string;
  is_active: boolean | null;
  name: string;
  start_date: string;
};

type AttendanceSession = {
  academic_year_id: string | null;
  batch_id: string;
  branch_id: string;
  id: string;
  notes: string | null;
  session_date: string;
};

type AttendanceRecord = {
  session_id: string;
  status: string;
  student_id: string;
};

function isDateValue(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getMonthStartDate(dateValue: string) {
  return `${dateValue.slice(0, 8)}01`;
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvResponse(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function exportErrorResponse() {
  return new Response("Could not export attendance.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 500,
  });
}

function logExportError(
  step: string,
  context: Record<string, string | number | null | undefined>,
  error: unknown,
) {
  console.error("attendance export failed", {
    error,
    step,
    ...context,
  });
}

export async function GET(request: NextRequest) {
  const context = await requirePermission("attendance.view");
  const { accessibleBranches, institute, supabase } = context;
  const searchParams = request.nextUrl.searchParams;
  const branchScope = getBranchScope(
    context,
    searchParams.get("branchId") ?? undefined,
  );
  const todayDate = getTodayDateValue();
  const csvHeaders = [
    "session_date",
    "academic_year",
    "branch_name",
    "batch_name",
    "student_name",
    "student_phone",
    "status",
    "session_notes",
  ];
  const logContext = {
    branch_id: branchScope.selectedBranchId,
    institute_id: institute.id,
    user_id: context.claims.sub,
  };

  let batchesQuery = supabase
    .from("batches")
    .select("id, branch_id, name")
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });

  if (branchScope.selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  const { data: batchRows, error: batchesError } = await batchesQuery;

  if (batchesError) {
    logExportError("load batches", logContext, batchesError);
    return exportErrorResponse();
  }

  const batches = (batchRows ?? []) as Batch[];
  const selectedBatch =
    batches.find((batch) => batch.id === searchParams.get("historyBatchId")) ??
    null;
  const historyBatchIds = selectedBatch
    ? [selectedBatch.id]
    : batches.map((batch) => batch.id);

  const { data: academicYearRows, error: academicYearsError } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_active")
    .eq("institute_id", institute.id)
    .order("start_date", { ascending: false });

  if (academicYearsError) {
    logExportError("load academic years", logContext, academicYearsError);
    return exportErrorResponse();
  }

  const academicYears = (academicYearRows ?? []) as AcademicYear[];
  const selectedAcademicYear =
    academicYears.find(
      (academicYear) => academicYear.id === searchParams.get("academicYearId"),
    ) ?? null;
  const selectedAcademicYearId = selectedAcademicYear?.id ?? "";
  const startDate = isDateValue(searchParams.get("startDate"))
    ? searchParams.get("startDate")!
    : selectedAcademicYear?.start_date ?? getMonthStartDate(todayDate);
  const endDate = isDateValue(searchParams.get("endDate"))
    ? searchParams.get("endDate")!
    : selectedAcademicYear?.end_date ?? todayDate;
  const filename = `attendance-${startDate}-to-${endDate}.csv`;

  if (!historyBatchIds.length) {
    return csvResponse([csvHeaders], filename);
  }

  const { data: studentBatchRows, error: studentBatchesError } = await supabase
    .from("student_batches")
    .select("student_id")
    .in("batch_id", historyBatchIds);

  if (studentBatchesError) {
    logExportError("load batch students", logContext, studentBatchesError);
    return exportErrorResponse();
  }

  const visibleStudentIds = Array.from(
    new Set(
      ((studentBatchRows ?? []) as StudentBatch[])
        .map((studentBatch) => studentBatch.student_id)
        .filter(Boolean),
    ),
  );

  let visibleStudents: Student[] = [];

  if (visibleStudentIds.length) {
    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, full_name, phone, branch_id")
      .eq("institute_id", institute.id)
      .in("id", visibleStudentIds)
      .order("full_name", { ascending: true });

    if (studentsError) {
      logExportError("load students", logContext, studentsError);
      return exportErrorResponse();
    }

    visibleStudents = (studentRows ?? []) as Student[];
  }

  const selectedStudent =
    visibleStudents.find(
      (student) => student.id === searchParams.get("studentId"),
    ) ?? null;
  const selectedStudentId = selectedStudent?.id ?? "";

  let sessionsQuery = supabase
    .from("attendance_sessions")
    .select(
      "id, branch_id, batch_id, academic_year_id, session_date, notes",
    )
    .eq("institute_id", institute.id)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .in("batch_id", historyBatchIds);

  if (selectedAcademicYearId) {
    sessionsQuery = sessionsQuery.eq(
      "academic_year_id",
      selectedAcademicYearId,
    );
  }

  if (branchScope.selectedBranchId) {
    sessionsQuery = sessionsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    sessionsQuery = sessionsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  const { data: sessionRows, error: sessionsError } = await sessionsQuery
    .order("session_date", { ascending: false })
    .limit(5000);

  if (sessionsError) {
    logExportError("load sessions", logContext, sessionsError);
    return exportErrorResponse();
  }

  const sessions = (sessionRows ?? []) as AttendanceSession[];
  const sessionIds = sessions.map((session) => session.id);

  if (!sessionIds.length || !visibleStudentIds.length) {
    return csvResponse([csvHeaders], filename);
  }

  let recordsQuery = supabase
    .from("attendance_records")
    .select("session_id, student_id, status")
    .in("session_id", sessionIds)
    .in("student_id", visibleStudentIds);

  if (selectedStudentId) {
    recordsQuery = recordsQuery.eq("student_id", selectedStudentId);
  }

  const { data: recordRows, error: recordsError } = await recordsQuery;

  if (recordsError) {
    logExportError("load records", logContext, recordsError);
    return exportErrorResponse();
  }

  const records = (recordRows ?? []) as AttendanceRecord[];
  const exportStudentIds = Array.from(
    new Set(records.map((record) => record.student_id).filter(Boolean)),
  );
  let exportStudents: Student[] = [];

  if (exportStudentIds.length) {
    const { data: exportStudentRows, error: exportStudentsError } =
      await supabase
        .from("students")
        .select("id, full_name, phone, branch_id")
        .eq("institute_id", institute.id)
        .in("id", exportStudentIds);

    if (exportStudentsError) {
      logExportError("load export students", logContext, exportStudentsError);
      return exportErrorResponse();
    }

    exportStudents = (exportStudentRows ?? []) as Student[];
  }

  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const academicYearsById = new Map(
    academicYears.map((academicYear) => [academicYear.id, academicYear]),
  );
  const sessionsById = new Map(
    sessions.map((session) => [session.id, session]),
  );
  const studentsById = new Map(
    exportStudents.map((student) => [student.id, student]),
  );

  const csvRows = records
    .map((record) => {
      const session = sessionsById.get(record.session_id);

      if (!session) {
        return null;
      }

      const academicYear = session.academic_year_id
        ? academicYearsById.get(session.academic_year_id)
        : null;
      const branch = branchesById.get(session.branch_id);
      const batch = batchesById.get(session.batch_id);
      const student = studentsById.get(record.student_id);

      return [
        session.session_date,
        academicYear?.name ?? "",
        branch?.name ?? "",
        batch?.name ?? "",
        student?.full_name ?? "",
        student?.phone ?? "",
        record.status,
        session.notes ?? "",
      ];
    })
    .filter((row): row is string[] => Boolean(row));

  return csvResponse([csvHeaders, ...csvRows], filename);
}

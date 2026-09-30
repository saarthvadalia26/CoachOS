import { NextRequest } from "next/server";

import { requirePermission, type AppRole } from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import { getSearchTerm } from "@/lib/dashboard/list-controls";
import { type FeeStatus, getFeeStatus } from "@/lib/fees/status";

export const dynamic = "force-dynamic";

type Student = {
  branch_id: string;
  full_name: string;
  id: string;
  phone: string | null;
};

type FeeRecord = {
  amount_due: number | string;
  amount_paid: number | string;
  branch_id: string;
  due_date: string | null;
  id: string;
  notes: string | null;
  status: string | null;
  student_id: string;
};

const exportRoles: readonly AppRole[] = [
  "owner",
  "branch_manager",
  "accountant",
];

const feeStatusOptions = ["pending", "paid", "overdue"] as const;

function canExportFeeReports(role: AppRole) {
  return exportRoles.includes(role);
}

function isDateValue(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getSelectedStatus(value: string | null | undefined) {
  if (feeStatusOptions.includes(value as FeeStatus)) {
    return value as FeeStatus;
  }

  return "";
}

function toAmount(value: number | string) {
  return Number(value);
}

function csvCell(value: string | number | null | undefined) {
  let str = String(value ?? "").replaceAll('"', '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

function csvResponse(rows: Array<Array<string | number>>, filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function exportErrorResponse(status = 500) {
  return new Response("Fee record export could not be generated.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status,
  });
}

function noRecordsResponse() {
  return new Response("No fee records match the selected filters.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 404,
  });
}

function logExportError(
  step: string,
  context: Record<string, string | number | null | undefined>,
  error: unknown,
) {
  console.error("fee records export failed", {
    error,
    step,
    ...context,
  });
}

export async function GET(request: NextRequest) {
  const context = await requirePermission("fees.view");
  const { accessibleBranches, claims, institute, role, supabase } = context;

  if (!canExportFeeReports(role)) {
    return exportErrorResponse(403);
  }

  const searchParams = request.nextUrl.searchParams;
  const branchScope = getBranchScope(
    context,
    searchParams.get("branchId") ?? undefined,
  );
  const selectedStatus = getSelectedStatus(searchParams.get("status"));
  const searchTerm = getSearchTerm(searchParams.get("q"));
  const startDate = isDateValue(searchParams.get("startDate"))
    ? searchParams.get("startDate")!
    : "";
  const endDate = isDateValue(searchParams.get("endDate"))
    ? searchParams.get("endDate")!
    : "";
  const csvHeaders = [
    "branch_name",
    "student_name",
    "student_phone",
    "amount_due",
    "amount_paid",
    "pending_amount",
    "due_date",
    "status",
    "notes",
  ];
  const filename = `fee-records-${startDate || "all"}-to-${endDate || "all"}.csv`;
  const logContext = {
    branch_id: branchScope.selectedBranchId,
    institute_id: institute.id,
    role,
    user_id: claims.sub,
  };

  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone")
    .eq("institute_id", institute.id)
    .order("full_name", { ascending: true });

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    studentsQuery = studentsQuery.or(
      `full_name.ilike.${searchPattern},phone.ilike.${searchPattern}`,
    );
  }

  const { data: studentRows, error: studentsError } = await studentsQuery;

  if (studentsError) {
    logExportError("load students", logContext, studentsError);
    return exportErrorResponse();
  }

  const students = (studentRows ?? []) as Student[];
  const selectedStudent =
    students.find((student) => student.id === searchParams.get("studentId")) ??
    null;
  const selectedStudentId = selectedStudent?.id ?? "";
  const searchStudentIds = students.map((student) => student.id);

  let feeRecordsQuery = supabase
    .from("fee_records")
    .select(
      "id, branch_id, student_id, amount_due, amount_paid, due_date, status, notes",
    )
    .eq("institute_id", institute.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5000);

  if (branchScope.selectedBranchId) {
    feeRecordsQuery = feeRecordsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    feeRecordsQuery = feeRecordsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  if (selectedStudentId) {
    feeRecordsQuery = feeRecordsQuery.eq("student_id", selectedStudentId);
  } else if (searchTerm) {
    feeRecordsQuery = searchStudentIds.length
      ? feeRecordsQuery.in("student_id", searchStudentIds)
      : feeRecordsQuery.eq(
          "student_id",
          "00000000-0000-0000-0000-000000000000",
        );
  }

  if (startDate) {
    feeRecordsQuery = feeRecordsQuery.gte("due_date", startDate);
  }

  if (endDate) {
    feeRecordsQuery = feeRecordsQuery.lte("due_date", endDate);
  }

  const { data: feeRecordRows, error: feeRecordsError } = await feeRecordsQuery;

  if (feeRecordsError) {
    logExportError("load fee records", logContext, feeRecordsError);
    return exportErrorResponse();
  }

  const todayDate = getTodayDateValue();
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const csvRows = ((feeRecordRows ?? []) as FeeRecord[])
    .map((record) => {
      const amountDue = toAmount(record.amount_due);
      const amountPaid = toAmount(record.amount_paid);
      const status = getFeeStatus({
        amountDue,
        amountPaid,
        dueDate: record.due_date,
        status: record.status,
        todayDate,
      });

      return {
        ...record,
        amountDue,
        amountPaid,
        pendingAmount: Math.max(amountDue - amountPaid, 0),
        status,
      };
    })
    .filter((record) => (selectedStatus ? record.status === selectedStatus : true))
    .map((record) => {
      const branch = branchesById.get(record.branch_id);
      const student = studentsById.get(record.student_id);

      return [
        branch?.name ?? "",
        student?.full_name ?? "",
        student?.phone ?? "",
        record.amountDue,
        record.amountPaid,
        record.pendingAmount,
        record.due_date ?? "",
        record.status,
        record.notes ?? "",
      ];
    });

  if (!csvRows.length) {
    return noRecordsResponse();
  }

  return csvResponse([csvHeaders, ...csvRows], filename);
}

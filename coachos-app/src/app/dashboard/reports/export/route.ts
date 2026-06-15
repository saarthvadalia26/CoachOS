import { NextRequest } from "next/server";

import { getReportsData, type ReportsSearchParams } from "@/lib/reports/data";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvResponse(
  rows: Array<Array<string | number | null | undefined>>,
  filename: string,
) {
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
  return new Response("Report export could not be generated.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status,
  });
}

function noRecordsResponse() {
  return new Response("No records match the selected filters.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 404,
  });
}

function getReportParams(searchParams: URLSearchParams): ReportsSearchParams {
  return {
    academicYearId: searchParams.get("academicYearId") ?? undefined,
    batchId: searchParams.get("batchId") ?? undefined,
    branchId: searchParams.get("branchId") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    studentId: searchParams.get("studentId") ?? undefined,
    subject: searchParams.get("subject") ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const report = request.nextUrl.searchParams.get("report") ?? "";

  try {
    const data = await getReportsData(getReportParams(request.nextUrl.searchParams));
    const filenameSuffix = `${data.filters.startDate || "all"}-to-${data.filters.endDate || "all"}`;

    if (report === "fees") {
      if (!data.access.canExportFees || !data.feeReport) {
        return exportErrorResponse(403);
      }

      if (!data.feeReport.records.length) {
        return noRecordsResponse();
      }

      return csvResponse(
        [
          [
            "branch_name",
            "student_name",
            "student_phone",
            "amount_due",
            "amount_paid",
            "pending_amount",
            "due_date",
            "status",
          ],
          ...data.feeReport.records.map((record) => [
            record.branchName,
            record.studentName,
            record.studentPhone,
            record.amountDue,
            record.amountPaid,
            record.pendingAmount,
            record.dueDate,
            record.status,
          ]),
        ],
        `monthly-fee-report-${filenameSuffix}.csv`,
      );
    }

    if (report === "attendance") {
      if (!data.access.canExportAttendance || !data.attendanceReport) {
        return exportErrorResponse(403);
      }

      if (!data.attendanceReport.studentRows.length) {
        return noRecordsResponse();
      }

      return csvResponse(
        [
          [
            "student_name",
            "branch_name",
            "attendance_percentage",
            "present_count",
            "absent_count",
            "late_count",
            "total_records",
          ],
          ...data.attendanceReport.studentRows.map((row) => [
            row.studentName,
            row.branchName,
            row.percentage,
            row.present,
            row.absent,
            row.late,
            row.total,
          ]),
        ],
        `attendance-percentage-report-${filenameSuffix}.csv`,
      );
    }

    if (report === "tests") {
      if (!data.access.canExportTests || !data.testReport) {
        return exportErrorResponse(403);
      }

      if (!data.testReport.studentRows.length) {
        return noRecordsResponse();
      }

      return csvResponse(
        [
          [
            "student_name",
            "branch_name",
            "average_percentage",
            "highest_percentage",
            "lowest_percentage",
            "marks_entered",
            "tests_count",
          ],
          ...data.testReport.studentRows.map((row) => [
            row.studentName,
            row.branchName,
            row.averagePercentage,
            row.highestPercentage,
            row.lowestPercentage,
            row.enteredScores,
            row.testsCount,
          ]),
        ],
        `test-performance-report-${filenameSuffix}.csv`,
      );
    }

    if (report === "branch") {
      if (!data.access.canExportBranchComparison || !data.branchComparison) {
        return exportErrorResponse(403);
      }

      if (!data.branchComparison.length) {
        return noRecordsResponse();
      }

      return csvResponse(
        [
          [
            "branch_name",
            "active_students",
            "active_batches",
            "attendance_percentage",
            "collected_fees",
            "pending_fees",
            "tests_conducted",
            "homework_assigned",
          ],
          ...data.branchComparison.map((row) => [
            row.branchName,
            row.activeStudents,
            row.activeBatches,
            row.attendancePercentage,
            row.collectedFees,
            row.pendingFees,
            row.testsConducted,
            row.homeworkAssigned,
          ]),
        ],
        `branch-comparison-report-${filenameSuffix}.csv`,
      );
    }

    if (report === "student") {
      const progress = data.studentProgress;
      const student = progress?.student ?? null;

      if (!data.access.canExportStudentProgress || !progress || !student) {
        return exportErrorResponse(403);
      }

      return csvResponse(
        [
          ["metric", "value"],
          ["student_name", student.full_name],
          ["student_phone", student.phone ?? ""],
          ["attendance_percentage", progress.attendance.percentage],
          ["attendance_records", progress.attendance.total],
          ["pending_fees", progress.fees.pendingAmount],
          ["fees_paid", progress.fees.totalPaid],
          ["homework_submitted", progress.homework.submitted],
          ["homework_assigned", progress.homework.assigned],
          ["test_average_percentage", progress.tests.averagePercentage],
          ["test_scores_entered", progress.tests.enteredScores],
        ],
        `student-progress-report-${filenameSuffix}.csv`,
      );
    }

    return exportErrorResponse(404);
  } catch (error) {
    console.error("dashboard report export failed", {
      error,
      report,
    });
    return exportErrorResponse();
  }
}

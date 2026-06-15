import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/formatters/date";
import { getReportsData, type ReportsSearchParams } from "@/lib/reports/data";

type ReportsPageProps = {
  searchParams: Promise<ReportsSearchParams>;
};

export const metadata: Metadata = {
  title: "Reports",
};

const filterControlClass =
  "box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "Not available" : `${value}%`;
}

function getExportHref(
  report: string,
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams({ report });

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  return `/dashboard/reports/export?${search.toString()}`;
}

function MetricCard({
  description,
  label,
  value,
}: {
  description?: string;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TableShell({
  children,
  emptyDescription,
  emptyTitle,
}: {
  children: ReactNode;
  emptyDescription: string;
  emptyTitle: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {children ? (
        children
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const reportData = await getReportsData(params);
  const {
    access,
    academicYears,
    attendanceReport,
    batches,
    branchComparison,
    context,
    feeReport,
    filters,
    loadErrors,
    selectedStudent,
    studentProgress,
    students,
    subjectOptions,
    testReport,
  } = reportData;
  const { accessibleBranches, claims, institute, profile, role } = context;
  const currentFilterParams = {
    academicYearId: filters.academicYearId,
    batchId: filters.batchId,
    branchId: filters.branchId,
    endDate: filters.endDate,
    q: filters.q,
    startDate: filters.startDate,
    studentId: filters.studentId,
    subject: filters.subject,
  };
  const hasReports =
    access.canViewAttendance ||
    access.canViewBranchComparison ||
    access.canViewFees ||
    access.canViewStudentProgress ||
    access.canViewTests;

  return (
    <DashboardShell
      activePage="reports"
      instituteName={institute.name}
      role={role}
      title="Reports"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        {loadErrors.map((error) => (
          <ActionMessage key={error} error={error} />
        ))}

        {!hasReports ? (
          <Card>
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
              <CardDescription>
                Reports are available only when your role has access to the
                related dashboard data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {hasReports ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Report filters</CardTitle>
                <CardDescription>
                  Filter reports by branch, batch, academic year, date range,
                  subject, and student.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4">
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {role === "owner" && accessibleBranches.length > 1 ? (
                      <Label className="min-w-0">
                        Branch
                        <select
                          className={filterControlClass}
                          defaultValue={filters.branchId}
                          name="branchId"
                        >
                          <option value="">All branches</option>
                          {accessibleBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </Label>
                    ) : null}

                    <Label className="min-w-0">
                      Batch
                      <select
                        className={filterControlClass}
                        defaultValue={filters.batchId}
                        name="batchId"
                      >
                        <option value="">All batches</option>
                        {batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.name}
                            {batch.subject ? ` - ${batch.subject}` : ""}
                          </option>
                        ))}
                      </select>
                    </Label>

                    <Label className="min-w-0">
                      Academic year
                      <select
                        className={filterControlClass}
                        defaultValue={filters.academicYearId}
                        name="academicYearId"
                      >
                        <option value="">Current date range</option>
                        {academicYears.map((academicYear) => (
                          <option key={academicYear.id} value={academicYear.id}>
                            {academicYear.name}
                            {academicYear.is_active ? " (Active)" : ""}
                          </option>
                        ))}
                      </select>
                    </Label>

                    <Label className="min-w-0">
                      From date
                      <Input
                        className="box-border h-10 w-full min-w-0"
                        defaultValue={filters.startDate}
                        name="startDate"
                        type="date"
                      />
                    </Label>

                    <Label className="min-w-0">
                      To date
                      <Input
                        className="box-border h-10 w-full min-w-0"
                        defaultValue={filters.endDate}
                        name="endDate"
                        type="date"
                      />
                    </Label>

                    <Label className="min-w-0">
                      Subject
                      <select
                        className={filterControlClass}
                        defaultValue={filters.subject}
                        name="subject"
                      >
                        <option value="">All subjects</option>
                        {subjectOptions.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                    </Label>

                    <Label className="min-w-0">
                      Student search
                      <Input
                        className="box-border h-10 w-full min-w-0"
                        defaultValue={filters.q}
                        name="q"
                        placeholder="Name or phone"
                        type="search"
                      />
                    </Label>

                    <Label className="min-w-0">
                      Student
                      <select
                        className={filterControlClass}
                        defaultValue={filters.studentId}
                        name="studentId"
                      >
                        <option value="">Select student for progress</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name}
                            {student.phone ? ` - ${student.phone}` : ""}
                          </option>
                        ))}
                      </select>
                    </Label>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="submit">Apply filters</Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/reports">Reset filters</Link>
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {feeReport && access.canViewFees ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">
                        Monthly fee report
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Fee collection, pending amount, and student-wise dues
                        for {formatDate(filters.startDate)} to{" "}
                        {formatDate(filters.endDate)}.
                      </CardDescription>
                    </div>
                    {access.canExportFees ? (
                      <ExportButton
                        disabled={!feeReport.records.length}
                        href={getExportHref("fees", currentFilterParams)}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard label="Fee records" value={feeReport.totalRecords} />
                    <MetricCard label="Total due" value={formatCurrency(feeReport.totalDue)} />
                    <MetricCard label="Collected" value={formatCurrency(feeReport.totalCollected)} />
                    <MetricCard label="Pending" value={formatCurrency(feeReport.totalPending)} />
                    <MetricCard label="Overdue" value={feeReport.overdueCount} />
                  </div>

                  {feeReport.pendingStudents.length ? (
                    <TableShell
                      emptyDescription="No fee records match the selected filters."
                      emptyTitle="No fee records"
                    >
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Student</th>
                            <th className="px-3 py-2 font-medium">Phone</th>
                            <th className="px-3 py-2 font-medium">Branch</th>
                            <th className="px-3 py-2 font-medium">Pending</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeReport.pendingStudents.slice(0, 10).map((row) => (
                            <tr key={row.studentId} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{row.studentName}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.studentPhone ?? "Not added"}
                              </td>
                              <td className="px-3 py-2">{row.branchName}</td>
                              <td className="px-3 py-2">{formatCurrency(row.pendingAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  ) : (
                    <EmptyState
                      title="No pending fees"
                      description="No student-wise pending fees match the selected filters."
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {attendanceReport && access.canViewAttendance ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">
                        Attendance percentage report
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Batch-wise and student-wise attendance percentages from
                        locked and saved attendance records.
                      </CardDescription>
                    </div>
                    {access.canExportAttendance ? (
                      <ExportButton
                        disabled={!attendanceReport.batchRows.length}
                        href={getExportHref("attendance", currentFilterParams)}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Attendance" value={formatPercent(attendanceReport.totals.percentage)} />
                    <MetricCard label="Present" value={attendanceReport.totals.present} />
                    <MetricCard label="Absent" value={attendanceReport.totals.absent} />
                    <MetricCard label="Late" value={attendanceReport.totals.late} />
                  </div>

                  {attendanceReport.batchRows.length ? (
                    <TableShell
                      emptyDescription="No attendance records match the selected filters."
                      emptyTitle="No attendance records"
                    >
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Batch</th>
                            <th className="px-3 py-2 font-medium">Branch</th>
                            <th className="px-3 py-2 font-medium">Attendance</th>
                            <th className="px-3 py-2 font-medium">Present</th>
                            <th className="px-3 py-2 font-medium">Absent</th>
                            <th className="px-3 py-2 font-medium">Late</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceReport.batchRows.map((row) => (
                            <tr key={row.batchId} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{row.batchName}</td>
                              <td className="px-3 py-2">{row.branchName}</td>
                              <td className="px-3 py-2">{formatPercent(row.percentage)}</td>
                              <td className="px-3 py-2">{row.present}</td>
                              <td className="px-3 py-2">{row.absent}</td>
                              <td className="px-3 py-2">{row.late}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  ) : (
                    <EmptyState
                      title="No attendance records"
                      description="No attendance records match the selected filters."
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {testReport && access.canViewTests ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">
                        Test performance report
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Batch averages, marks entry progress, and student-wise
                        performance for selected tests.
                      </CardDescription>
                    </div>
                    {access.canExportTests ? (
                      <ExportButton
                        disabled={!testReport.batchRows.length}
                        href={getExportHref("tests", currentFilterParams)}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Tests conducted" value={testReport.testsConducted} />
                    <MetricCard label="Marks entered" value={testReport.marksEntered} />
                    <MetricCard label="Highest score" value={formatPercent(testReport.highestPercentage)} />
                    <MetricCard label="Lowest score" value={formatPercent(testReport.lowestPercentage)} />
                  </div>

                  {testReport.batchRows.length ? (
                    <TableShell
                      emptyDescription="No tests match the selected filters."
                      emptyTitle="No test records"
                    >
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Batch</th>
                            <th className="px-3 py-2 font-medium">Branch</th>
                            <th className="px-3 py-2 font-medium">Average</th>
                            <th className="px-3 py-2 font-medium">Highest</th>
                            <th className="px-3 py-2 font-medium">Lowest</th>
                            <th className="px-3 py-2 font-medium">Marks entered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testReport.batchRows.map((row) => (
                            <tr key={row.batchId} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{row.batchName}</td>
                              <td className="px-3 py-2">{row.branchName}</td>
                              <td className="px-3 py-2">{formatPercent(row.averagePercentage)}</td>
                              <td className="px-3 py-2">{formatPercent(row.highestPercentage)}</td>
                              <td className="px-3 py-2">{formatPercent(row.lowestPercentage)}</td>
                              <td className="px-3 py-2">
                                {row.marksEntered} / {row.totalScores}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  ) : (
                    <EmptyState
                      title="No test records"
                      description="No tests match the selected filters."
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {branchComparison && access.canViewBranchComparison ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">
                        Branch comparison report
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Compare active students, batches, attendance, fees,
                        tests, and homework across branches.
                      </CardDescription>
                    </div>
                    {access.canExportBranchComparison ? (
                      <ExportButton
                        disabled={!branchComparison.length}
                        href={getExportHref("branch", currentFilterParams)}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {branchComparison.length ? (
                    <TableShell
                      emptyDescription="Create branches and records to compare institute performance."
                      emptyTitle="No branch comparison available"
                    >
                      <table className="w-full min-w-[960px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Branch</th>
                            <th className="px-3 py-2 font-medium">Students</th>
                            <th className="px-3 py-2 font-medium">Batches</th>
                            <th className="px-3 py-2 font-medium">Attendance</th>
                            <th className="px-3 py-2 font-medium">Collected</th>
                            <th className="px-3 py-2 font-medium">Pending fees</th>
                            <th className="px-3 py-2 font-medium">Tests</th>
                            <th className="px-3 py-2 font-medium">Homework</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branchComparison.map((row) => (
                            <tr key={row.branchId} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{row.branchName}</td>
                              <td className="px-3 py-2">{row.activeStudents}</td>
                              <td className="px-3 py-2">{row.activeBatches}</td>
                              <td className="px-3 py-2">{formatPercent(row.attendancePercentage)}</td>
                              <td className="px-3 py-2">{formatCurrency(row.collectedFees)}</td>
                              <td className="px-3 py-2">{formatCurrency(row.pendingFees)}</td>
                              <td className="px-3 py-2">{row.testsConducted}</td>
                              <td className="px-3 py-2">{row.homeworkAssigned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  ) : (
                    <EmptyState
                      title="No branch comparison available"
                      description="Create branches and records to compare institute performance."
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {access.canViewStudentProgress ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-xl">
                        Student progress report
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Select a student to review attendance, fees, homework,
                        tests, and recent activity.
                      </CardDescription>
                    </div>
                    {studentProgress && access.canExportStudentProgress ? (
                      <ExportButton
                        href={getExportHref("student", currentFilterParams)}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {studentProgress?.student ? (
                    <div className="grid gap-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {studentProgress.student.full_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {studentProgress.student.phone ?? "Phone not added"}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {selectedStudent ? "Selected student" : "Student"}
                        </Badge>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                          label="Attendance"
                          value={formatPercent(studentProgress.attendance.percentage)}
                          description={`${studentProgress.attendance.total} records`}
                        />
                        <MetricCard
                          label="Pending fees"
                          value={formatCurrency(studentProgress.fees.pendingAmount)}
                          description={`${formatCurrency(studentProgress.fees.totalPaid)} paid`}
                        />
                        <MetricCard
                          label="Homework submitted"
                          value={`${studentProgress.homework.submitted} / ${studentProgress.homework.assigned}`}
                          description={`${studentProgress.homework.checked} checked`}
                        />
                        <MetricCard
                          label="Test average"
                          value={formatPercent(studentProgress.tests.averagePercentage)}
                          description={`${studentProgress.tests.enteredScores} scores entered`}
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Select a student"
                      description="Use the Student filter above to generate an individual progress report."
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </section>
    </DashboardShell>
  );
}

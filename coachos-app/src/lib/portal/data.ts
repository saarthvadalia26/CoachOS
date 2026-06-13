import type { PortalContext, PortalStudent } from "@/lib/portal/context";

export type PortalBatch = {
  branch_id: string;
  id: string;
  name: string;
  schedule: string | null;
  subject: string | null;
};

export type PortalAttendanceEntry = {
  batch: PortalBatch | null;
  sessionDate: string;
  status: string;
};

export type PortalHomeworkEntry = {
  batch: PortalBatch | null;
  dueDate: string | null;
  id: string;
  status: string;
  subject: string | null;
  submissionStatus: string;
  title: string;
};

export type PortalTestEntry = {
  id: string;
  marksObtained: number | null;
  maxMarks: number;
  status: string;
  subject: string | null;
  testDate: string;
  title: string;
};

export type PortalFeeRecord = {
  amountDue: number;
  amountPaid: number;
  dueDate: string | null;
  id: string;
  pendingAmount: number;
  status: string | null;
};

export type PortalStudentData = {
  attendanceEntries: PortalAttendanceEntry[];
  attendancePercentage: string;
  batches: PortalBatch[];
  fees: PortalFeeRecord[];
  homework: PortalHomeworkEntry[];
  tests: PortalTestEntry[];
};

type StudentBatchRow = {
  batch_id: string;
};

type AttendanceSessionRow = {
  batch_id: string;
  id: string;
  session_date: string;
};

type AttendanceRecordRow = {
  session_id: string;
  status: string;
};

type HomeworkAssignmentRow = {
  batch_id: string;
  due_date: string | null;
  id: string;
  status: string;
  subject: string | null;
  title: string;
};

type HomeworkSubmissionRow = {
  homework_id: string;
  status: string;
};

type TestRow = {
  batch_id: string;
  id: string;
  max_marks: number | string;
  status: string;
  subject: string | null;
  test_date: string;
  title: string;
};

type TestScoreRow = {
  marks_obtained: number | string | null;
  status: string;
  test_id: string;
};

function calculateAttendancePercentage(entries: PortalAttendanceEntry[]) {
  if (!entries.length) {
    return "0%";
  }

  const attended = entries.filter(
    (entry) => entry.status === "present" || entry.status === "late",
  ).length;

  return `${Math.round((attended / entries.length) * 100)}%`;
}

function toNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

export async function getPortalStudentData(
  context: PortalContext,
  student: PortalStudent,
  options: { includeFees: boolean },
): Promise<PortalStudentData> {
  const { supabase } = context;
  const { data: studentBatchRows, error: studentBatchesError } = await supabase
    .from("student_batches")
    .select("batch_id")
    .eq("student_id", student.id);

  if (studentBatchesError) {
    console.error("portal student batch lookup failed", studentBatchesError);
  }

  const batchIds = Array.from(
    new Set(
      ((studentBatchRows ?? []) as StudentBatchRow[]).map(
        (row) => row.batch_id,
      ),
    ),
  );
  let batches: PortalBatch[] = [];

  if (batchIds.length) {
    const { data: batchRows, error: batchesError } = await supabase
      .from("batches")
      .select("id, branch_id, name, subject, schedule")
      .in("id", batchIds)
      .order("created_at", { ascending: false });

    if (batchesError) {
      console.error("portal batch lookup failed", batchesError);
    } else {
      batches = (batchRows ?? []) as PortalBatch[];
    }
  }

  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  let attendanceEntries: PortalAttendanceEntry[] = [];

  if (batchIds.length) {
    const { data: sessionRows, error: sessionsError } = await supabase
      .from("attendance_sessions")
      .select("id, batch_id, session_date")
      .in("batch_id", batchIds)
      .order("session_date", { ascending: false });

    if (sessionsError) {
      console.error("portal attendance session lookup failed", sessionsError);
    }

    const sessions = (sessionRows ?? []) as AttendanceSessionRow[];
    const sessionIds = sessions.map((session) => session.id);
    const sessionsById = new Map(
      sessions.map((session) => [session.id, session]),
    );

    if (sessionIds.length) {
      const { data: recordRows, error: recordsError } = await supabase
        .from("attendance_records")
        .select("session_id, status")
        .eq("student_id", student.id)
        .in("session_id", sessionIds);

      if (recordsError) {
        console.error("portal attendance record lookup failed", recordsError);
      } else {
        attendanceEntries = ((recordRows ?? []) as AttendanceRecordRow[])
          .map((record) => {
            const session = sessionsById.get(record.session_id);

            if (!session) {
              return null;
            }

            return {
              batch: batchesById.get(session.batch_id) ?? null,
              sessionDate: session.session_date,
              status: record.status,
            };
          })
          .filter((entry): entry is PortalAttendanceEntry => Boolean(entry))
          .sort((first, second) =>
            second.sessionDate.localeCompare(first.sessionDate),
          );
      }
    }
  }

  let homework: PortalHomeworkEntry[] = [];

  if (batchIds.length) {
    const { data: homeworkRows, error: homeworkError } = await supabase
      .from("homework_assignments")
      .select("id, batch_id, title, subject, due_date, status")
      .in("batch_id", batchIds)
      .neq("status", "archived")
      .order("due_date", { ascending: true, nullsFirst: false });

    if (homeworkError) {
      console.error("portal homework lookup failed", homeworkError);
    }

    const assignments = (homeworkRows ?? []) as HomeworkAssignmentRow[];
    const homeworkIds = assignments.map((assignment) => assignment.id);
    let submissionsByHomeworkId = new Map<string, HomeworkSubmissionRow>();

    if (homeworkIds.length) {
      const { data: submissionRows, error: submissionError } = await supabase
        .from("homework_submissions")
        .select("homework_id, status")
        .eq("student_id", student.id)
        .in("homework_id", homeworkIds);

      if (submissionError) {
        console.error("portal homework submission lookup failed", submissionError);
      } else {
        submissionsByHomeworkId = new Map(
          ((submissionRows ?? []) as HomeworkSubmissionRow[]).map(
            (submission) => [submission.homework_id, submission],
          ),
        );
      }
    }

    homework = assignments.map((assignment) => ({
      batch: batchesById.get(assignment.batch_id) ?? null,
      dueDate: assignment.due_date,
      id: assignment.id,
      status: assignment.status,
      subject: assignment.subject,
      submissionStatus:
        submissionsByHomeworkId.get(assignment.id)?.status ?? "assigned",
      title: assignment.title,
    }));
  }

  let tests: PortalTestEntry[] = [];

  if (batchIds.length) {
    const { data: testRows, error: testsError } = await supabase
      .from("tests")
      .select("id, batch_id, title, subject, test_date, max_marks, status")
      .in("batch_id", batchIds)
      .neq("status", "archived")
      .order("test_date", { ascending: false });

    if (testsError) {
      console.error("portal test lookup failed", testsError);
    }

    const testRecords = (testRows ?? []) as TestRow[];
    const testIds = testRecords.map((test) => test.id);
    let scoresByTestId = new Map<string, TestScoreRow>();

    if (testIds.length) {
      const { data: scoreRows, error: scoreError } = await supabase
        .from("test_scores")
        .select("test_id, marks_obtained, status")
        .eq("student_id", student.id)
        .in("test_id", testIds);

      if (scoreError) {
        console.error("portal test score lookup failed", scoreError);
      } else {
        scoresByTestId = new Map(
          ((scoreRows ?? []) as TestScoreRow[]).map((score) => [
            score.test_id,
            score,
          ]),
        );
      }
    }

    tests = testRecords.map((test) => {
      const score = scoresByTestId.get(test.id);

      return {
        id: test.id,
        marksObtained: toNumber(score?.marks_obtained ?? null),
        maxMarks: Number(test.max_marks),
        status: score?.status ?? "not_entered",
        subject: test.subject,
        testDate: test.test_date,
        title: test.title,
      };
    });
  }

  let fees: PortalFeeRecord[] = [];

  if (options.includeFees) {
    const { data: feeRows, error: feeError } = await supabase
      .from("fee_records")
      .select("id, amount_due, amount_paid, due_date, status")
      .eq("student_id", student.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (feeError) {
      console.error("portal fee lookup failed", feeError);
    } else {
      fees = (feeRows ?? []).map((record) => {
        const amountDue = Number(record.amount_due);
        const amountPaid = Number(record.amount_paid);

        return {
          amountDue,
          amountPaid,
          dueDate: record.due_date,
          id: record.id,
          pendingAmount: Math.max(amountDue - amountPaid, 0),
          status: record.status,
        };
      });
    }
  }

  return {
    attendanceEntries,
    attendancePercentage: calculateAttendancePercentage(attendanceEntries),
    batches,
    fees,
    homework,
    tests,
  };
}

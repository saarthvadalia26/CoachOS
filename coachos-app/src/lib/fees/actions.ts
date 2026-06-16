"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/log";
import {
  canAccessPermission,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getFeeStatus } from "@/lib/fees/status";

const FEES_PATH = "/dashboard/fees";

function redirectWithError(message: string): never {
  redirect(`${FEES_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string, branchId?: string | null): never {
  const params = new URLSearchParams({
    success: message,
  });

  if (branchId) {
    params.set("branchId", branchId);
  }

  redirect(`${FEES_PATH}?${params.toString()}`);
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

function getAmount(
  formData: FormData,
  key: string,
  label: string,
  options: { required?: boolean } = {},
) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue && !options.required) {
    return 0;
  }

  if (!rawValue) {
    redirectWithError(`${label} is required.`);
  }

  const amount = Number(rawValue);

  if (!Number.isFinite(amount) || amount < 0) {
    redirectWithError(`${label} must be a valid positive amount.`);
  }

  return amount;
}

function requireBranchPermission(
  context: DashboardContext,
  permission: Permission,
  branchId: string | null,
) {
  if (!branchId || !canAccessPermission(context, permission, { branchId })) {
    redirectWithError("You do not have permission to perform this action.");
  }
}

export async function createFeeRecord(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;

  const studentId = getRequiredText(formData, "studentId", "Student");
  const amountDue = getAmount(formData, "amountDue", "Amount due", {
    required: true,
  });
  const amountPaid = getAmount(formData, "amountPaid", "Amount paid");
  const dueDate = getOptionalText(formData, "dueDate");
  const notes = getOptionalText(formData, "notes");

  if (amountDue <= 0) {
    redirectWithError("Amount due must be greater than zero.");
  }

  if (amountPaid > amountDue) {
    redirectWithError("Amount paid cannot be greater than amount due.");
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, branch_id, full_name")
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (studentError) {
    console.error("createFeeRecord student lookup failed", studentError);
    redirectWithError("The selected student record could not be verified.");
  }

  if (!student) {
    redirectWithError("Select a student from this institute.");
  }

  requireBranchPermission(context, "fees.create", student.branch_id);

  if (amountPaid > 0) {
    requireBranchPermission(context, "fees.record_payment", student.branch_id);
  }

  const status = getFeeStatus({
    amountDue,
    amountPaid,
    dueDate,
    todayDate: getTodayDateValue(),
  });

  const { data: feeRecord, error } = await supabase
    .from("fee_records")
    .insert({
      amount_due: amountDue,
      amount_paid: amountPaid,
      branch_id: student.branch_id,
      due_date: dueDate,
      institute_id: institute.id,
      notes,
      status,
      student_id: studentId,
    })
    .select("id")
    .maybeSingle();

  if (error || !feeRecord) {
    console.error("createFeeRecord failed", error);
    redirectWithError(
      "This fee record could not be saved. Please review the details and try again.",
    );
  }

  await logActivity(context, {
    action: "fee.created",
    branchId: student.branch_id,
    description: "Fee Record created.",
    entityId: feeRecord.id,
    entityLabel: student.full_name ?? "Student fee",
    entityType: "fee",
    metadata: {
      amountDue,
      amountPaid,
      status,
    },
  });

  revalidatePath(FEES_PATH);
  redirectWithSuccess("Fee record created.", student.branch_id);
}

export async function markFeeRecordPaid(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const feeRecordId = getRequiredText(formData, "feeRecordId", "Fee record");

  const { data: feeRecord, error: feeRecordError } = await supabase
    .from("fee_records")
    .select("id, amount_due, branch_id, student_id")
    .eq("id", feeRecordId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (feeRecordError) {
    console.error("markFeeRecordPaid lookup failed", feeRecordError);
    redirectWithError("The selected fee record could not be verified.");
  }

  if (!feeRecord) {
    redirectWithError("Select a fee record from this institute.");
  }

  requireBranchPermission(context, "fees.mark_paid", feeRecord.branch_id);
  requireBranchPermission(context, "fees.record_payment", feeRecord.branch_id);

  const { error } = await supabase
    .from("fee_records")
    .update({
      amount_paid: feeRecord.amount_due,
      status: "paid",
    })
    .eq("id", feeRecord.id)
    .eq("institute_id", institute.id);

  if (error) {
    console.error("markFeeRecordPaid failed", error);
    redirectWithError(
      "This fee record could not be marked as paid. Please try again.",
    );
  }

  const { data: paidStudent, error: paidStudentError } = await supabase
    .from("students")
    .select("full_name")
    .eq("id", feeRecord.student_id)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (paidStudentError) {
    console.error("markFeeRecordPaid student lookup failed", paidStudentError);
  }

  await logActivity(context, {
    action: "fee.marked_paid",
    branchId: feeRecord.branch_id,
    description: "Payment marked as paid.",
    entityId: feeRecord.id,
    entityLabel: paidStudent?.full_name ?? "Fee Record",
    entityType: "fee",
    metadata: {
      amountPaid: feeRecord.amount_due,
    },
  });

  revalidatePath(FEES_PATH);
  redirectWithSuccess("Payment marked as paid.", feeRecord.branch_id);
}

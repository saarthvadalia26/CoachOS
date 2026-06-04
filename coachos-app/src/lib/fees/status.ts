export const feeStatuses = ["pending", "paid", "overdue"] as const;

export type FeeStatus = (typeof feeStatuses)[number];

type FeeStatusInput = {
  amountDue: number;
  amountPaid: number;
  dueDate: string | null;
  status?: string | null;
  todayDate: string;
};

export function getFeeStatus({
  amountDue,
  amountPaid,
  dueDate,
  status,
  todayDate,
}: FeeStatusInput): FeeStatus {
  if (status === "paid" || amountPaid >= amountDue) {
    return "paid";
  }

  if (status === "overdue" || (dueDate && dueDate < todayDate)) {
    return "overdue";
  }

  return "pending";
}

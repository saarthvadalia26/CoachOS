export const communicationAudiences = [
  "all_staff",
  "branch_staff",
  "owners",
  "branch_managers",
  "operations_staff",
  "accountants",
  "academic_coordinators",
  "teachers",
] as const;

export type CommunicationAudience = (typeof communicationAudiences)[number];

export const communicationPriorities = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type CommunicationPriority = (typeof communicationPriorities)[number];

export type NotificationItem = {
  body: string;
  branch_id: string | null;
  created_at: string;
  id: string;
  priority: CommunicationPriority;
  title: string;
  type: "announcement" | "fee_reminder" | "attendance_alert" | "system";
  unread: boolean;
};

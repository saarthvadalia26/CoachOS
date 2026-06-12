"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  requireDashboardAccess,
  requirePermission,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import {
  communicationAudiences,
  communicationPriorities,
  type CommunicationAudience,
  type CommunicationPriority,
  type NotificationItem,
} from "@/lib/communication/constants";

const COMMUNICATION_PATH = "/dashboard/communication";

function getRequiredString(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getSafeNextPath(formData: FormData) {
  const next = String(formData.get("next") ?? "").trim();

  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return COMMUNICATION_PATH;
}

function redirectWith(path: string, key: "error" | "success", message: string): never {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);

  params.set(key, message);
  redirect(`${pathname}?${params.toString()}`);
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function redirectWithCommunicationError(message: string): never {
  redirectWith(COMMUNICATION_PATH, "error", message);
}

function parseAudience(value: string): CommunicationAudience {
  if (communicationAudiences.includes(value as CommunicationAudience)) {
    return value as CommunicationAudience;
  }

  return "all_staff";
}

function parsePriority(value: string): CommunicationPriority {
  if (communicationPriorities.includes(value as CommunicationPriority)) {
    return value as CommunicationPriority;
  }

  return "normal";
}

function getBranchName(
  context: Pick<DashboardContext, "accessibleBranches">,
  branchId: string | null,
) {
  if (!branchId) {
    return "All branches";
  }

  return (
    context.accessibleBranches.find((branch) => branch.id === branchId)?.name ??
    "Assigned branch"
  );
}

function resolveAnnouncementBranchId(
  context: DashboardContext,
  requestedBranchId: string | null,
) {
  if (context.role === "owner") {
    if (!requestedBranchId || requestedBranchId === "all") {
      return null;
    }

    const branch = context.accessibleBranches.find(
      (item) => item.id === requestedBranchId,
    );

    if (!branch) {
      throw new Error("Select a valid branch.");
    }

    return branch.id;
  }

  if (context.role !== "branch_manager" || !context.branchId) {
    throw new Error("You do not have permission to perform this action.");
  }

  return context.branchId;
}

function canManageAnnouncementBranch(
  context: DashboardContext,
  branchId: string | null,
  permission: Permission,
) {
  if (context.role === "owner") {
    return canAccessPermission(context, permission, {
      instituteId: context.institute.id,
      branchId,
    });
  }

  return Boolean(
    branchId &&
      context.role === "branch_manager" &&
      canAccessPermission(context, permission, { branchId }),
  );
}

async function getAnnouncementForManagement(
  context: DashboardContext,
  announcementId: string,
  permission: Permission,
) {
  const { data: announcement, error } = await context.supabase
    .from("announcements")
    .select("id, institute_id, branch_id")
    .eq("id", announcementId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error) {
    console.error("announcement lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    throw new Error("This announcement could not be verified.");
  }

  if (
    !announcement ||
    !canManageAnnouncementBranch(context, announcement.branch_id, permission)
  ) {
    throw new Error("You do not have permission to perform this action.");
  }

  return announcement;
}

async function insertNotificationForAnnouncement({
  announcementId,
  body,
  branchId,
  context,
  priority,
  title,
}: {
  announcementId: string;
  body: string;
  branchId: string | null;
  context: DashboardContext;
  priority: CommunicationPriority;
  title: string;
}) {
  const { error } = await context.supabase.from("notification_items").insert({
    body,
    branch_id: branchId,
    institute_id: context.institute.id,
    priority,
    source_id: announcementId,
    source_table: "announcements",
    title,
    type: "announcement",
  });

  if (error) {
    console.error("announcement notification insert failed", {
      announcementId,
      branchId,
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
    });
    throw new Error("Announcement notification could not be created.");
  }
}

export async function createAnnouncement(formData: FormData) {
  const context = await requirePermission("communications.create");

  try {
    const title = getRequiredString(formData, "title", "Title");
    const body = getRequiredString(formData, "body", "Message");
    const audience = parseAudience(String(formData.get("audience") ?? ""));
    const priority = parsePriority(String(formData.get("priority") ?? ""));
    const branchId = resolveAnnouncementBranchId(
      context,
      getOptionalString(formData, "branchId"),
    );

    if (!canManageAnnouncementBranch(context, branchId, "communications.create")) {
      throw new Error("You do not have permission to perform this action.");
    }

    const { data: announcement, error } = await context.supabase
      .from("announcements")
      .insert({
        audience,
        body,
        branch_id: branchId,
        created_by: context.claims.sub,
        institute_id: context.institute.id,
        priority,
        title,
      })
      .select("id")
      .single();

    if (error || !announcement) {
      console.error("createAnnouncement failed", {
        branchId,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        instituteId: context.institute.id,
        message: error?.message,
        role: context.role,
      });
      throw new Error("Could not publish announcement.");
    }

    try {
      await insertNotificationForAnnouncement({
        announcementId: announcement.id,
        body,
        branchId,
        context,
        priority,
        title,
      });
    } catch (notificationError) {
      await context.supabase
        .from("announcements")
        .delete()
        .eq("id", announcement.id);
      throw notificationError;
    }

    revalidatePath("/dashboard", "layout");
    redirectWith(COMMUNICATION_PATH, "success", "Announcement published.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("createAnnouncement action failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      instituteId: context.institute.id,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithCommunicationError(
      error instanceof Error && error.message.endsWith("required.")
        ? error.message
        : "Could not publish announcement. Please try again.",
    );
  }
}

export async function updateAnnouncement(formData: FormData) {
  const context = await requirePermission("communications.update");

  try {
    const announcementId = getRequiredString(
      formData,
      "announcementId",
      "Announcement",
    );
    const title = getRequiredString(formData, "title", "Title");
    const body = getRequiredString(formData, "body", "Message");
    const audience = parseAudience(String(formData.get("audience") ?? ""));
    const priority = parsePriority(String(formData.get("priority") ?? ""));
    const existingAnnouncement = await getAnnouncementForManagement(
      context,
      announcementId,
      "communications.update",
    );
    const branchId = resolveAnnouncementBranchId(
      context,
      getOptionalString(formData, "branchId") ?? existingAnnouncement.branch_id,
    );

    if (!canManageAnnouncementBranch(context, branchId, "communications.update")) {
      throw new Error("You do not have permission to perform this action.");
    }

    const { error } = await context.supabase
      .from("announcements")
      .update({
        audience,
        body,
        branch_id: branchId,
        priority,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcementId);

    if (error) {
      console.error("updateAnnouncement failed", {
        announcementId,
        branchId,
        code: error.code,
        details: error.details,
        hint: error.hint,
        instituteId: context.institute.id,
        message: error.message,
        role: context.role,
      });
      throw new Error("Could not update announcement.");
    }

    revalidatePath("/dashboard", "layout");
    redirectWith(COMMUNICATION_PATH, "success", "Announcement updated.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("updateAnnouncement action failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      instituteId: context.institute.id,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithCommunicationError(
      error instanceof Error && error.message.endsWith("required.")
        ? error.message
        : "Could not update announcement. Please try again.",
    );
  }
}

export async function deleteAnnouncement(formData: FormData) {
  const context = await requirePermission("communications.delete");

  try {
    const announcementId = getRequiredString(
      formData,
      "announcementId",
      "Announcement",
    );

    await getAnnouncementForManagement(
      context,
      announcementId,
      "communications.delete",
    );

    const { error: notificationError } = await context.supabase
      .from("notification_items")
      .delete()
      .eq("source_table", "announcements")
      .eq("source_id", announcementId);

    if (notificationError) {
      console.error("deleteAnnouncement notification cleanup failed", {
        announcementId,
        code: notificationError.code,
        details: notificationError.details,
        hint: notificationError.hint,
        message: notificationError.message,
      });
      throw new Error("Could not delete announcement.");
    }

    const { error } = await context.supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId);

    if (error) {
      console.error("deleteAnnouncement failed", {
        announcementId,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
      throw new Error("Could not delete announcement.");
    }

    revalidatePath("/dashboard", "layout");
    redirectWith(COMMUNICATION_PATH, "success", "Announcement deleted.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error("deleteAnnouncement action failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      instituteId: context.institute.id,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithCommunicationError(
      "Could not delete announcement. Please try again.",
    );
  }
}

export async function listAnnouncements(limit = 50) {
  const context = await requirePermission("communications.view");
  const { data, error } = await context.supabase
    .from("announcements")
    .select(
      "id, institute_id, branch_id, title, body, audience, priority, created_by, created_at, updated_at",
    )
    .eq("institute_id", context.institute.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listAnnouncements failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
    });

    return { announcements: [], context, error: true };
  }

  return { announcements: data ?? [], context, error: false };
}

async function getVisibleNotificationRows(context: DashboardContext, limit = 50) {
  const { data, error } = await context.supabase
    .from("notification_items")
    .select("id, branch_id, title, body, type, priority, created_at")
    .eq("institute_id", context.institute.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("notification list failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
    });

    return [];
  }

  return data ?? [];
}

async function attachReadState(
  context: DashboardContext,
  rows: Array<Omit<NotificationItem, "unread">>,
) {
  if (!rows.length) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const { data: readRows, error } = await context.supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", context.claims.sub)
    .in("notification_id", ids);

  if (error) {
    console.error("notification read lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      userId: context.claims.sub,
    });
  }

  const readIds = new Set((readRows ?? []).map((row) => row.notification_id));

  return rows.map((row) => ({
    ...row,
    unread: !readIds.has(row.id),
  }));
}

export async function listNotifications(limit = 50) {
  const context = await requirePermission("notifications.view");
  const rows = await getVisibleNotificationRows(context, limit);
  const notifications = await attachReadState(context, rows);

  return { context, notifications };
}

export async function getNotificationBellData(limit = 8) {
  const context = await requireDashboardAccess();

  if (!canAccessPermission(context, "notifications.view")) {
    return { notifications: [], unreadCount: 0 };
  }

  const rows = await getVisibleNotificationRows(context, 100);
  const notifications = await attachReadState(context, rows);

  return {
    notifications: notifications.slice(0, limit),
    unreadCount: notifications.filter((notification) => notification.unread)
      .length,
  };
}

export async function getUnreadNotificationCount() {
  const { unreadCount } = await getNotificationBellData(1);

  return unreadCount;
}

export async function markNotificationRead(formData: FormData) {
  const context = await requirePermission("notifications.update");
  const nextPath = getSafeNextPath(formData);

  try {
    const notificationId = getRequiredString(
      formData,
      "notificationId",
      "Notification",
    );
    const { data: notification, error: notificationError } =
      await context.supabase
        .from("notification_items")
        .select("id")
        .eq("id", notificationId)
        .maybeSingle();

    if (notificationError || !notification) {
      throw new Error("Notification could not be verified.");
    }

    const { error } = await context.supabase.from("notification_reads").upsert(
      {
        notification_id: notificationId,
        user_id: context.claims.sub,
      },
      { onConflict: "notification_id,user_id" },
    );

    if (error) {
      console.error("markNotificationRead failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        notificationId,
        userId: context.claims.sub,
      });
      throw new Error("Notification could not be marked as read.");
    }

    revalidatePath("/dashboard", "layout");
    redirectWith(nextPath, "success", "Notification marked as read.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    redirectWith(nextPath, "error", "Notification could not be updated.");
  }
}

export async function markAllNotificationsRead(formData: FormData) {
  const context = await requirePermission("notifications.update");
  const nextPath = getSafeNextPath(formData);

  try {
    const rows = await getVisibleNotificationRows(context, 500);
    const readRows = rows.map((row) => ({
      notification_id: row.id,
      user_id: context.claims.sub,
    }));

    if (readRows.length) {
      const { error } = await context.supabase
        .from("notification_reads")
        .upsert(readRows, { onConflict: "notification_id,user_id" });

      if (error) {
        console.error("markAllNotificationsRead failed", {
          code: error.code,
          details: error.details,
          hint: error.hint,
          message: error.message,
          userId: context.claims.sub,
        });
        throw new Error("Notifications could not be marked as read.");
      }
    }

    revalidatePath("/dashboard", "layout");
    redirectWith(nextPath, "success", "Notifications marked as read.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    redirectWith(nextPath, "error", "Notifications could not be updated.");
  }
}

async function createScopedNotification({
  body,
  branchId,
  context,
  permission,
  priority = "normal",
  title,
  type,
}: {
  body: string;
  branchId: string;
  context: DashboardContext;
  permission: Permission;
  priority?: CommunicationPriority;
  title: string;
  type: "fee_reminder" | "attendance_alert";
}) {
  if (!canAccessPermission(context, permission, { branchId })) {
    throw new Error("You do not have permission to perform this action.");
  }

  const { error } = await context.supabase.from("notification_items").insert({
    body,
    branch_id: branchId,
    institute_id: context.institute.id,
    priority,
    title,
    type,
  });

  if (error) {
    console.error("createScopedNotification failed", {
      branchId,
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      type,
    });
    throw new Error("Notification could not be created.");
  }
}

export async function createFeeReminderNotification(formData: FormData) {
  const context = await requirePermission("fees.send_reminder");
  const nextPath = getSafeNextPath(formData);

  try {
    const branchId = getRequiredString(formData, "branchId", "Branch");
    const title = getOptionalString(formData, "title") ?? "Fee reminder";
    const body =
      getOptionalString(formData, "body") ??
      `Fee follow-up created for ${getBranchName(context, branchId)}.`;

    await createScopedNotification({
      body,
      branchId,
      context,
      permission: "fees.send_reminder",
      priority: parsePriority(String(formData.get("priority") ?? "")),
      title,
      type: "fee_reminder",
    });

    revalidatePath("/dashboard", "layout");
    redirectWith(nextPath, "success", "Fee reminder created.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    redirectWith(nextPath, "error", "Fee reminder could not be created.");
  }
}

export async function createAttendanceAlertNotification(formData: FormData) {
  const context = await requirePermission("attendance.alert");
  const nextPath = getSafeNextPath(formData);

  try {
    const branchId = getRequiredString(formData, "branchId", "Branch");
    const title =
      getOptionalString(formData, "title") ?? "Attendance submission reminder";
    const body =
      getOptionalString(formData, "body") ??
      `Attendance follow-up created for ${getBranchName(context, branchId)}.`;

    await createScopedNotification({
      body,
      branchId,
      context,
      permission: "attendance.alert",
      priority: parsePriority(String(formData.get("priority") ?? "")),
      title,
      type: "attendance_alert",
    });

    revalidatePath("/dashboard", "layout");
    redirectWith(nextPath, "success", "Attendance alert created.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    redirectWith(nextPath, "error", "Attendance alert could not be created.");
  }
}

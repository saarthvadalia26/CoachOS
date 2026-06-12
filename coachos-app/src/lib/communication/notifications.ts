import type { DashboardContext } from "@/lib/auth/permissions";
import type { NotificationItem } from "@/lib/communication/constants";

export async function getVisibleNotificationRows(
  context: DashboardContext,
  limit = 50,
) {
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

export async function attachNotificationReadState(
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

export async function getNotificationFeed(
  context: DashboardContext,
  limit = 8,
) {
  const rows = await getVisibleNotificationRows(context, Math.max(limit, 100));
  const notifications = await attachNotificationReadState(context, rows);

  return {
    notifications: notifications.slice(0, limit),
    unreadCount: notifications.filter((notification) => notification.unread)
      .length,
  };
}

export async function markNotificationReadForContext(
  context: DashboardContext,
  notificationId: string,
) {
  const { data: notification, error: notificationError } =
    await context.supabase
      .from("notification_items")
      .select("id")
      .eq("id", notificationId)
      .maybeSingle();

  if (notificationError || !notification) {
    console.error("notification verification failed", {
      code: notificationError?.code,
      details: notificationError?.details,
      hint: notificationError?.hint,
      message: notificationError?.message,
      notificationId,
      role: context.role,
      userId: context.claims.sub,
    });
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
}

export async function markAllNotificationsReadForContext(
  context: DashboardContext,
) {
  const rows = await getVisibleNotificationRows(context, 500);
  const readRows = rows.map((row) => ({
    notification_id: row.id,
    user_id: context.claims.sub,
  }));

  if (!readRows.length) {
    return;
  }

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

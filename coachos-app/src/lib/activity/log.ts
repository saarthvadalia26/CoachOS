import "server-only";

import { revalidatePath } from "next/cache";

import type { DashboardContext } from "@/lib/auth/permissions";

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type ActivityMetadata = Record<string, unknown>;

type ActivityLogInput = {
  action: string;
  branchId?: string | null;
  description?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  entityType: string;
  metadata?: ActivityMetadata | null;
};

const sensitiveKeyParts = [
  "auth",
  "cookie",
  "key",
  "password",
  "secret",
  "token",
];

function isSensitiveKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return sensitiveKeyParts.some((part) => normalizedKey.includes(part));
}

function sanitizeValue(value: unknown, depth = 0): JsonValue {
  if (depth > 4) {
    return "[Truncated]";
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? "[Redacted]" : sanitizeValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
}

function sanitizeMetadata(metadata: ActivityMetadata | null | undefined) {
  if (!metadata) {
    return null;
  }

  return sanitizeValue(metadata) as JsonValue;
}

export async function logActivity(
  context: DashboardContext,
  {
    action,
    branchId,
    description,
    entityId,
    entityLabel,
    entityType,
    metadata,
  }: ActivityLogInput,
) {
  const { error } = await context.supabase.from("activity_logs").insert({
    action,
    actor_name: context.profile.full_name ?? context.claims.email ?? null,
    actor_role: context.role,
    actor_user_id: context.claims.sub,
    branch_id: branchId ?? null,
    description: description ?? null,
    entity_id: entityId ?? null,
    entity_label: entityLabel ?? null,
    entity_type: entityType,
    institute_id: context.institute.id,
    metadata: sanitizeMetadata(metadata),
  });

  if (error) {
    console.error("activity log insert failed", {
      action,
      branchId: branchId ?? null,
      code: error.code,
      details: error.details,
      entityId: entityId ?? null,
      entityType,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/activity");
}

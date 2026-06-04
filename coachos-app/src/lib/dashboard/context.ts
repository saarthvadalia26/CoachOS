import { requireDashboardAccess } from "@/lib/auth/permissions";

export async function getDashboardContext() {
  return requireDashboardAccess();
}

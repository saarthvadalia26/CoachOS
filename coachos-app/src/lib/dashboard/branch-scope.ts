import type { Branch, DashboardContext } from "@/lib/auth/permissions";

export type BranchScope = {
  isAllBranches: boolean;
  selectedBranchId: string | null;
  selectedBranchName: string;
  showOwnerBranchFilter: boolean;
  visibleBranchIds: string[];
};

export function getBranchById(
  branches: readonly Branch[],
  branchId: string | null | undefined,
) {
  if (!branchId) {
    return null;
  }

  return branches.find((branch) => branch.id === branchId) ?? null;
}

export function getBranchScope(
  context: Pick<
    DashboardContext,
    "accessibleBranches" | "branchId" | "branchScope"
  >,
  requestedBranchId?: string,
): BranchScope {
  const requestedBranch = getBranchById(
    context.accessibleBranches,
    requestedBranchId,
  );

  if (context.branchScope === "all") {
    const selectedBranchId = requestedBranch?.id ?? null;

    return {
      isAllBranches: selectedBranchId === null,
      selectedBranchId,
      selectedBranchName: requestedBranch?.name ?? "All branches",
      showOwnerBranchFilter: context.accessibleBranches.length > 1,
      visibleBranchIds: selectedBranchId ? [selectedBranchId] : [],
    };
  }

  const selectedBranchId =
    requestedBranch?.id ??
    context.branchId ??
    context.accessibleBranches[0]?.id ??
    null;
  const selectedBranch = getBranchById(
    context.accessibleBranches,
    selectedBranchId,
  );

  return {
    isAllBranches: false,
    selectedBranchId,
    selectedBranchName: selectedBranch?.name ?? "Assigned branch",
    showOwnerBranchFilter: false,
    visibleBranchIds: selectedBranchId
      ? [selectedBranchId]
      : context.accessibleBranches.map((branch) => branch.id),
  };
}

export function needsExplicitBranchSelection(
  context: Pick<DashboardContext, "accessibleBranches" | "branchScope">,
) {
  return context.branchScope === "all" && context.accessibleBranches.length > 1;
}

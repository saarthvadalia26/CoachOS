import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Branch } from "@/lib/auth/permissions";

type BranchFilterProps = {
  allLabel?: string;
  branches: Branch[];
  hiddenFields?: Record<string, string | null | undefined>;
  selectedBranchId: string | null;
};

export function BranchFilter({
  allLabel = "All branches",
  branches,
  hiddenFields,
  selectedBranchId,
}: BranchFilterProps) {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto] sm:items-end">
      {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
        value ? <input key={name} name={name} type="hidden" value={value} /> : null,
      )}
      <Label>
        Branch
        <select
          name="branchId"
          defaultValue={selectedBranchId ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          <option value="">{allLabel}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </Label>
      <SubmitButton pendingLabel="Filtering..." variant="outline">
        Apply
      </SubmitButton>
    </form>
  );
}

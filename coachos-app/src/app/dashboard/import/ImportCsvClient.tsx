"use client";

import { CheckCircle2, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  getCsvPreview,
  importDefinitions,
  type CsvRow,
} from "@/lib/import/csv";
import {
  importBatchesFromCsv,
  importStudentBatchAssignmentsFromCsv,
  importStudentsFromCsv,
} from "@/lib/import/actions";
import type {
  CsvImportKind,
  ImportActionResult,
  ImportSummary,
} from "@/lib/import/types";
import { errorToast, successToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ImportCsvClientProps = {
  branchNameRequired: boolean;
  enabledImports: readonly CsvImportKind[];
};

type PreviewRow = CsvRow & {
  issues: string[];
};

const importOrder: CsvImportKind[] = ["students", "batches", "assignments"];

const previewColumns: Record<CsvImportKind, string[]> = {
  assignments: ["student_name", "student_phone", "batch_name", "branch_name"],
  batches: ["name", "subject", "branch_name", "status"],
  students: [
    "full_name",
    "phone",
    "parent_phone",
    "student_email",
    "parent_email",
    "branch_name",
    "status",
  ],
};

function getEmptySummary(): ImportSummary {
  return {
    errorRows: 0,
    errors: [],
    importedRows: 0,
    skippedRows: 0,
    totalRows: 0,
  };
}

function formatColumnLabel(column: string) {
  return column.replaceAll("_", " ");
}

function SummaryGrid({ summary }: { summary: ImportSummary }) {
  const items = [
    ["Rows", summary.totalRows],
    ["Imported", summary.importedRows],
    ["Skipped", summary.skippedRows],
    ["Errors", summary.errorRows],
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-lg border border-border bg-muted/20 px-3 py-2"
        >
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ImportSection({
  branchNameRequired,
  kind,
}: {
  branchNameRequired: boolean;
  kind: CsvImportKind;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const definition = importDefinitions[kind];
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const preview = useMemo(
    () =>
      csvText
        ? getCsvPreview(kind, csvText, { branchNameRequired })
        : null,
    [branchNameRequired, csvText, kind],
  );
  const hasBlockingErrors = Boolean(preview?.hasBlockingErrors);
  const visibleRows = preview?.rows.slice(0, 8) ?? [];
  const visibleColumns = previewColumns[kind].filter(
    (column) => branchNameRequired || column !== "branch_name",
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);

    if (!file) {
      setCsvText("");
      setFileName("");
      return;
    }

    try {
      const text = await file.text();
      setCsvText(text);
      setFileName(file.name);
    } catch {
      setCsvText("");
      setFileName("");
      errorToast("The CSV file could not be read. Please try again.");
    }
  }

  async function runImport() {
    if (!csvText || hasBlockingErrors) {
      errorToast("Import failed. Please review the CSV.");
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const importResult =
        kind === "students"
          ? await importStudentsFromCsv(csvText)
          : kind === "batches"
            ? await importBatchesFromCsv(csvText)
            : await importStudentBatchAssignmentsFromCsv(csvText);

      setResult(importResult);

      if (importResult.ok) {
        successToast(importResult.message);
        setCsvText("");
        setFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      } else {
        errorToast(importResult.message);
      }
    } catch {
      errorToast("Import failed. Please review the CSV.");
      setResult({
        message: "Import failed. Please review the CSV.",
        ok: false,
        summary: getEmptySummary(),
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">{definition.label}</CardTitle>
            <CardDescription className="mt-2">
              {definition.description}
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={definition.templateHref} download>
              <FileText aria-hidden="true" data-icon="inline-start" />
              Download template
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Label className="min-w-0">
            CSV file
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="mt-2 block h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </Label>
          <Button
            type="button"
            onClick={runImport}
            disabled={!csvText || hasBlockingErrors || isImporting}
            className="w-full lg:w-auto"
          >
            {isImporting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                />
                Importing...
              </>
            ) : (
              <>
                <Upload aria-hidden="true" data-icon="inline-start" />
                Confirm import
              </>
            )}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Preview</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fileName
                  ? `${fileName} selected. Review validation results before importing.`
                  : "Select a CSV file to preview rows before importing."}
              </p>
            </div>
            {preview ? (
              <Badge variant={hasBlockingErrors ? "destructive" : "secondary"}>
                {hasBlockingErrors ? "Needs review" : "Ready to import"}
              </Badge>
            ) : null}
          </div>

          {preview ? (
            <div className="mt-4 grid gap-4">
              {preview.fileIssues.length ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-medium">File issues</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preview.fileIssues.map((issue) => (
                      <li key={`${issue.rowNumber}-${issue.message}`}>
                        Row {issue.rowNumber}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-border bg-background">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      {visibleColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-medium">
                          {formatColumnLabel(column)}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row: PreviewRow) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.rowNumber}
                        </td>
                        {visibleColumns.map((column) => (
                          <td key={column} className="px-3 py-2">
                            {row.values[column] || "Not added"}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {row.issues.length ? (
                            <div className="flex items-start gap-2 text-destructive">
                              <XCircle
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0"
                              />
                              <span>{row.issues.join(" ")}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2
                                aria-hidden="true"
                                className="size-4 shrink-0"
                              />
                              Ready
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.rows.length > visibleRows.length ? (
                <p className="text-sm text-muted-foreground">
                  Showing first {visibleRows.length} of {preview.rows.length} rows.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {result ? (
          <div
            className={cn(
              "grid gap-3 rounded-lg border p-4",
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <p className="text-sm font-medium">{result.message}</p>
            <SummaryGrid summary={result.summary} />
            {result.summary.errors.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.summary.errors.slice(0, 8).map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.message}`}>
                    Row {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ImportCsvClient({
  branchNameRequired,
  enabledImports,
}: ImportCsvClientProps) {
  const enabledSet = new Set(enabledImports);
  const visibleImports = importOrder.filter((kind) => enabledSet.has(kind));

  return (
    <div className="grid gap-6">
      {visibleImports.map((kind) => (
        <ImportSection
          key={kind}
          branchNameRequired={branchNameRequired}
          kind={kind}
        />
      ))}
    </div>
  );
}

import type { CsvImportKind, ImportRowIssue } from "@/lib/import/types";

export type CsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type CsvParseResult = {
  errors: ImportRowIssue[];
  headers: string[];
  rows: CsvRow[];
};

export const importDefinitions: Record<
  CsvImportKind,
  {
    description: string;
    label: string;
    requiredColumns: readonly string[];
    templateHref: string;
  }
> = {
  students: {
    description:
      "Import student profiles with branch-safe validation before records are created.",
    label: "Students",
    requiredColumns: ["full_name"],
    templateHref: "/templates/students-template.csv",
  },
  batches: {
    description:
      "Import batches into the correct branch with duplicate name checks.",
    label: "Batches",
    requiredColumns: ["name"],
    templateHref: "/templates/batches-template.csv",
  },
  assignments: {
    description:
      "Connect existing students to existing batches by matching them inside the same branch.",
    label: "Student-batch assignments",
    requiredColumns: ["student_name", "batch_name"],
    templateHref: "/templates/student-batch-assignments-template.csv",
  },
};

const studentStatuses = new Set(["", "active", "archived", "inactive"]);
const activeOnlyStatuses = new Set(["", "active"]);

export function normalizeCsvHeader(header: string) {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeCsvValue(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function normalizeLookupValue(value: string | null | undefined) {
  return normalizeCsvValue(value).toLowerCase();
}

function pushRecord(records: string[][], row: string[]) {
  const isBlank = row.every((field) => !field.trim());

  if (!isBlank) {
    records.push(row);
  }
}

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let field = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(field);
      pushRecord(records, row);
      row = [];
      field = "";

      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    pushRecord(records, row);
  }

  return records;
}

export function parseCsv(text: string): CsvParseResult {
  const cleanedText = text.replace(/^\uFEFF/, "").trim();

  if (!cleanedText) {
    return {
      errors: [{ message: "Select a CSV file with at least one data row.", rowNumber: 1 }],
      headers: [],
      rows: [],
    };
  }

  const records = parseCsvRecords(cleanedText);
  const rawHeaders = records[0] ?? [];
  const headers = rawHeaders.map(normalizeCsvHeader);
  const errors: ImportRowIssue[] = [];

  if (!headers.length) {
    errors.push({ message: "CSV header row is required.", rowNumber: 1 });
  }

  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );

  if (duplicateHeaders.length) {
    errors.push({
      message: `Duplicate columns found: ${Array.from(new Set(duplicateHeaders)).join(", ")}.`,
      rowNumber: 1,
    });
  }

  const rows = records.slice(1).map((record, index) => {
    const values: Record<string, string> = {};

    headers.forEach((header, headerIndex) => {
      if (header) {
        values[header] = normalizeCsvValue(record[headerIndex]);
      }
    });

    return {
      rowNumber: index + 2,
      values,
    };
  });

  if (!rows.length) {
    errors.push({ message: "CSV must include at least one data row.", rowNumber: 2 });
  }

  return { errors, headers, rows };
}

function getMissingColumns(
  headers: readonly string[],
  requiredColumns: readonly string[],
  branchNameRequired: boolean,
) {
  const expectedColumns = branchNameRequired
    ? [...requiredColumns, "branch_name"]
    : [...requiredColumns];

  return expectedColumns.filter((column) => !headers.includes(column));
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRowIssues(
  kind: CsvImportKind,
  row: CsvRow,
  branchNameRequired: boolean,
) {
  const issues: string[] = [];
  const definition = importDefinitions[kind];

  for (const column of definition.requiredColumns) {
    if (!normalizeCsvValue(row.values[column])) {
      issues.push(`${column.replaceAll("_", " ")} is required.`);
    }
  }

  if (branchNameRequired && !normalizeCsvValue(row.values.branch_name)) {
    issues.push("branch name is required.");
  }

  if (kind === "students") {
    const status = normalizeLookupValue(row.values.status);

    if (!studentStatuses.has(status)) {
      issues.push("status must be active, inactive, or archived.");
    }

    if (!isValidEmail(normalizeCsvValue(row.values.student_email))) {
      issues.push("student email must be a valid email address.");
    }

    if (!isValidEmail(normalizeCsvValue(row.values.parent_email))) {
      issues.push("parent email must be a valid email address.");
    }
  }

  if (kind === "batches") {
    const status = normalizeLookupValue(row.values.status);

    if (!activeOnlyStatuses.has(status)) {
      issues.push("batch status must be active or blank.");
    }
  }

  return issues;
}

export function getCsvPreview(
  kind: CsvImportKind,
  csvText: string,
  options: { branchNameRequired: boolean },
) {
  const parsed = parseCsv(csvText);
  const definition = importDefinitions[kind];
  const missingColumns = getMissingColumns(
    parsed.headers,
    definition.requiredColumns,
    options.branchNameRequired,
  );
  const fileIssues = [
    ...parsed.errors,
    ...missingColumns.map((column) => ({
      message: `Missing required column: ${column}.`,
      rowNumber: 1,
    })),
  ];
  const rows = parsed.rows.map((row) => ({
    ...row,
    issues: getRowIssues(kind, row, options.branchNameRequired),
  }));
  const rowIssueCount = rows.filter((row) => row.issues.length).length;

  return {
    fileIssues,
    headers: parsed.headers,
    hasBlockingErrors: fileIssues.length > 0 || rowIssueCount > 0,
    rows,
    rowIssueCount,
  };
}

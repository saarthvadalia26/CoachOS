export type CsvImportKind = "assignments" | "batches" | "students";

export type ImportRowIssue = {
  message: string;
  rowNumber: number;
};

export type ImportSummary = {
  errorRows: number;
  errors: ImportRowIssue[];
  importedRows: number;
  skippedRows: number;
  totalRows: number;
};

export type ImportActionResult = {
  message: string;
  ok: boolean;
  summary: ImportSummary;
};

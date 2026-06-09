export const defaultPageSize = 10;

export function getPage(value: string | null | undefined) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function getPaginationRange(page: number, pageSize = defaultPageSize) {
  const from = (page - 1) * pageSize;

  return {
    from,
    to: from + pageSize - 1,
  };
}

export function getTotalPages(totalCount: number, pageSize = defaultPageSize) {
  return Math.max(Math.ceil(totalCount / pageSize), 1);
}

export function getSearchTerm(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replaceAll(",", " ")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

export function isDateValue(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getPageSummary({
  page,
  pageSize = defaultPageSize,
  shownCount,
  totalCount,
}: {
  page: number;
  pageSize?: number;
  shownCount: number;
  totalCount: number;
}) {
  if (!totalCount || !shownCount) {
    return "0 records";
  }

  const firstRecord = (page - 1) * pageSize + 1;
  const lastRecord = firstRecord + shownCount - 1;

  return `Showing ${firstRecord}-${lastRecord} of ${totalCount}`;
}

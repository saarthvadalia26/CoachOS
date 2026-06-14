const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDate(value: string | null | undefined) {
  const date = parseDateValue(value);

  return date ? dayFormatter.format(date) : "Not set";
}

export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);

  if (!start || !end) {
    return "Dates not set";
  }

  return `${monthYearFormatter.format(start)} – ${monthYearFormatter.format(end)}`;
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return timestampFormatter.format(date);
}

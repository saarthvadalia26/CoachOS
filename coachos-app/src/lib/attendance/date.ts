const APP_TIME_ZONE = "Asia/Kolkata";

export function getTodayDateValue() {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const dateParts = new Map(parts.map((part) => [part.type, part.value]));

  return `${dateParts.get("year")}-${dateParts.get("month")}-${dateParts.get("day")}`;
}

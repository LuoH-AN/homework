const DEFAULT_TIMEZONE = process.env.TIMEZONE || "Asia/Shanghai";

function partsMap(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = new Map<string, string>();
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map.set(part.type, part.value);
    }
  });
  return map;
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = partsMap(date, timeZone);
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function formatDateTime(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = partsMap(date, timeZone);
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")} ${parts.get("hour")}:${parts.get("minute")}`;
}

export function addHours(iso: string, hours: number) {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

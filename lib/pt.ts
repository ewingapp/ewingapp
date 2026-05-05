// Pacific Time helpers. The app's domain is California State scheduling, so all
// wall-clock times the user enters or sees mean PT (PST in winter, PDT in summer).
// These helpers work the same on the Vercel server (UTC) and any browser TZ.

export const PT_TZ = "America/Los_Angeles";

const PT_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: PT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const PT_TIME_12H = new Intl.DateTimeFormat("en-US", {
  timeZone: PT_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const PT_DATE_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: PT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function ptParts(date: Date) {
  const parts = PT_PARTS.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

// Convert a PT wall-clock (year/month1-12/day/hour/minute) to the UTC instant.
// Handles DST automatically by sampling the actual offset for the resulting instant.
export function ptWallToUtc(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naiveMs = Date.UTC(year, month1 - 1, day, hour, minute, 0, 0);
  const p = ptParts(new Date(naiveMs));
  const wallAsUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(naiveMs + (naiveMs - wallAsUtcMs));
}

// Combine a YYYY-MM-DD date string with PT hour:minute → UTC Date.
export function ptDateTime(dateStr: string, hour: number, minute: number): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Bad date string: ${dateStr}`);
  return ptWallToUtc(Number(m[1]), Number(m[2]), Number(m[3]), hour, minute);
}

// Start/end of a PT calendar day, returned as UTC Date instants.
export function ptStartOfDay(dateStr: string): Date {
  return ptDateTime(dateStr, 0, 0);
}
export function ptEndOfDay(dateStr: string): Date {
  return new Date(ptDateTime(dateStr, 23, 59).getTime() + 59_999);
}

// "YYYY-MM-DD" for the PT calendar day containing `date`.
export function ptDateIso(date: Date): string {
  return PT_DATE_ISO.format(date);
}

// "YYYY-MM-DD" for PT today.
export function ptTodayIso(): string {
  return ptDateIso(new Date());
}

// Format a Date / ISO string as "h:mm AM/PM" in PT.
export function ptFmtTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return PT_TIME_12H.format(d);
}

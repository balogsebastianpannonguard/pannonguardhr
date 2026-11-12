const TIME_ZONE = "Europe/Budapest";

const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A budapesti naptári nap ÉÉÉÉ-HH-NN formában. */
export function dayKey(date: Date) {
  return isoDay.format(date);
}

export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const dayLabel = new Intl.DateTimeFormat("hu-HU", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const shortDay = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", weekday: "short" });

export function formatDay(key: string) {
  return dayLabel.format(new Date(`${key}T12:00:00Z`));
}

export function formatShortDay(key: string) {
  return shortDay.format(new Date(`${key}T12:00:00Z`)).replace(".", "");
}

const stamp = new Intl.DateTimeFormat("hu-HU", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatStamp(date?: Date) {
  return date ? stamp.format(date) : "–";
}

const hour = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });

export function budapestHour(date: Date) {
  return Number(hour.format(date));
}

export function greeting(date: Date) {
  const h = budapestHour(date);
  if (h < 5) return "Jó éjszakát";
  if (h < 10) return "Jó reggelt";
  if (h < 18) return "Szép napot";
  return "Jó estét";
}

const offsetParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zoneOffsetMs(utcMs: number) {
  const parts = Object.fromEntries(offsetParts.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

/** Budapesti helyi időpont (nap + ÓÓ:PP) valódi időpillanatként, téli/nyári időszámítással. */
export function budapestTime(day: string, time: string) {
  const naive = new Date(`${day}T${time}:00Z`).getTime();
  const first = naive - zoneOffsetMs(naive);
  return new Date(naive - zoneOffsetMs(first));
}

const timeOnly = new Intl.DateTimeFormat("hu-HU", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
export function formatTime(date: Date) {
  return timeOnly.format(date);
}

const monthLabel = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", year: "numeric", month: "long" });
export function formatMonth(month: string) {
  return monthLabel.format(new Date(`${month}-15T12:00:00Z`));
}

export function monthKey(date: Date) {
  return dayKey(date).slice(0, 7);
}

export function addMonths(month: string, count: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

const shortDate = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", month: "short", day: "numeric" });
export function formatShortDate(key: string) {
  return shortDate.format(new Date(`${key}T12:00:00Z`));
}

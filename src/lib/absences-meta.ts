/** Távollétek: szótárak, magyar munkaszüneti napok és munkanap-számítás (kliensen és szerveren is használható). */

export const ABSENCE_TYPES = {
  szabadsag: "Szabadság",
  betegszabadsag: "Betegszabadság",
  tappenz: "Táppénz",
  fizetes_nelkuli: "Fizetés nélküli szabadság",
  igazolatlan: "Igazolatlan távollét",
  tanulmanyi: "Tanulmányi szabadság",
  egyeb: "Egyéb távollét",
} as const;
export type AbsenceType = keyof typeof ABSENCE_TYPES;
export const isAbsenceType = (value: string): value is AbsenceType => value in ABSENCE_TYPES;

/** Típusonkénti szín (a naptárban és a diagramokon ugyanaz). */
export const ABSENCE_COLORS: Record<AbsenceType, string> = {
  szabadsag: "#e8a796",
  betegszabadsag: "#e9679b",
  tappenz: "#f7a8c8",
  fizetes_nelkuli: "#8fa2ff",
  igazolatlan: "#f87171",
  tanulmanyi: "#f8d4c6",
  egyeb: "#a3a8c3",
};

export type AbsenceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: AbsenceType;
  from: string;
  to: string;
  halfDay: boolean;
  note?: string;
  /** Munkanapok száma (H–P, munkaszüneti napok nélkül; fél nap = 0,5). */
  days: number;
};

/* ---------- Munkaszüneti napok ---------- */

const pad = (value: number) => String(value).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Húsvétvasárnap (Gauss–Meeus-féle algoritmus, Gergely-naptár). */
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return key(year, month, day);
}

const shift = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Az Mt. 102. § szerinti munkaszüneti napok egy évben (dátum → megnevezés). */
export function publicHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  return new Map([
    [key(year, 1, 1), "Újév"],
    [key(year, 3, 15), "Nemzeti ünnep"],
    [shift(easter, -2), "Nagypéntek"],
    [easter, "Húsvétvasárnap"],
    [shift(easter, 1), "Húsvéthétfő"],
    [key(year, 5, 1), "A munka ünnepe"],
    [shift(easter, 49), "Pünkösdvasárnap"],
    [shift(easter, 50), "Pünkösdhétfő"],
    [key(year, 8, 20), "Államalapítás ünnepe"],
    [key(year, 10, 23), "Nemzeti ünnep"],
    [key(year, 11, 1), "Mindenszentek"],
    [key(year, 12, 25), "Karácsony"],
    [key(year, 12, 26), "Karácsony"],
  ]);
}

/**
 * Munkanap-áthelyezések (a miniszteri rendelet szerint). Pihenőnap: hétköznap, amely nem munkanap; ledolgozós
 * szombat: munkanap. A 2025-ös és 2026-os rendelet szerinti napok; 2027-re még nincs (ha megjelenik, ide kell felvenni).
 */
const BRIDGE_REST_DAYS: Record<string, string> = {
  "2025-05-02": "Áthelyezett pihenőnap",
  "2025-10-24": "Áthelyezett pihenőnap",
  "2025-12-24": "Áthelyezett pihenőnap",
  "2026-01-02": "Áthelyezett pihenőnap",
  "2026-08-21": "Áthelyezett pihenőnap",
  "2026-12-24": "Áthelyezett pihenőnap",
};
const BRIDGE_WORKDAYS = new Set(["2025-05-17", "2025-10-18", "2025-12-13", "2026-01-10", "2026-08-08", "2026-12-12"]);

const holidayCache = new Map<number, Map<string, string>>();
function holidaysOf(year: number) {
  let map = holidayCache.get(year);
  if (!map) {
    map = publicHolidays(year);
    holidayCache.set(year, map);
  }
  return map;
}

/** A nap megnevezése, ha munkaszüneti vagy áthelyezett pihenőnap; különben `undefined`. */
export function holidayName(day: string) {
  return holidaysOf(Number(day.slice(0, 4))).get(day) ?? BRIDGE_REST_DAYS[day];
}

/** ISO hét napja: 1 = hétfő … 7 = vasárnap. */
export const weekday = (day: string) => {
  const value = new Date(`${day}T12:00:00Z`).getUTCDay();
  return value === 0 ? 7 : value;
};

/** Munkanap-e: hétfő–péntek, munkaszüneti és áthelyezett pihenőnap nélkül, plusz a ledolgozós szombatok. */
export function isWorkday(day: string) {
  if (BRIDGE_WORKDAYS.has(day)) return true;
  return weekday(day) <= 5 && !holidayName(day);
}

/** Munkanapok száma a [from, to] zárt intervallumban; `halfDay` egynapos tételnél 0,5. */
export function workingDays(from: string, to: string, halfDay = false) {
  if (!from || !to || to < from) return 0;
  let count = 0;
  for (let day = from; day <= to; day = shift(day, 1)) if (isWorkday(day)) count += 1;
  return halfDay && from === to ? count * 0.5 : count;
}

/** Az intervallum metszete egy másik intervallummal (pl. hónappal, évvel); `null`, ha nincs. */
export function clip(from: string, to: string, start: string, end: string) {
  const a = from > start ? from : start;
  const b = to < end ? to : end;
  return a <= b ? { from: a, to: b } : null;
}

/** A [from, to] napjai. */
export function eachDay(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = shift(day, 1)) days.push(day);
  return days;
}

/* ---------- Szabadság-keret javaslat (Mt. 116–118. §) ---------- */

/** Életkor szerinti pótszabadság abban az évben, amelyben a dolgozó betölti az adott kort. */
export function ageExtraDays(birthYear: number, year: number) {
  const age = year - birthYear;
  const steps: [number, number][] = [
    [45, 10],
    [43, 9],
    [41, 8],
    [39, 7],
    [37, 6],
    [35, 5],
    [33, 4],
    [31, 3],
    [28, 2],
    [25, 1],
  ];
  return steps.find(([limit]) => age >= limit)?.[1] ?? 0;
}

/** Gyermek után járó pótszabadság (16 év alatti gyermekek száma; fogyatékos gyermekenként +2). */
export function childExtraDays(children: number, disabledChildren = 0) {
  const base = children <= 0 ? 0 : children === 1 ? 2 : children === 2 ? 4 : 7;
  return base + Math.max(0, disabledChildren) * 2;
}

/** Javasolt éves keret: 20 nap alapszabadság + életkor szerinti + gyermek utáni pótszabadság. */
export function suggestAllowance({ birthYear, year, children = 0, disabledChildren = 0 }: { birthYear?: number; year: number; children?: number; disabledChildren?: number }) {
  const age = birthYear ? ageExtraDays(birthYear, year) : 0;
  const child = childExtraDays(children, disabledChildren);
  return { base: 20, age, child, total: 20 + age + child };
}

export const formatDays = (value: number) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(value);

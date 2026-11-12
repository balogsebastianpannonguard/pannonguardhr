/**
 * A munkavállalói nyilvántartás szótárai és tiszta segédfüggvényei. Kliens- és szerveroldalon is használható
 * (nincs adatbázis-hozzáférés); a `@/lib/employees` mindent újraexportál innen.
 */

/* ---------- Szótárak (a felületen és az AI-promptokban is ezek a megnevezések) ---------- */

export const EMPLOYEE_STATUS = {
  aktiv: "Aktív",
  belepes: "Belépés alatt",
  szunetel: "Szünetel (GYED, tartós távollét)",
  kilepett: "Kilépett",
} as const;
export type EmployeeStatus = keyof typeof EMPLOYEE_STATUS;

export const EMPLOYEE_STATUS_TONE: Record<EmployeeStatus, "ok" | "info" | "warning" | "muted"> = {
  aktiv: "ok",
  belepes: "info",
  szunetel: "warning",
  kilepett: "muted",
};

/** Rövid állapotnév (listákhoz, címkékhez). */
export const EMPLOYEE_STATUS_SHORT: Record<EmployeeStatus, string> = {
  aktiv: "Aktív",
  belepes: "Belépés alatt",
  szunetel: "Szünetel",
  kilepett: "Kilépett",
};

export const EMPLOYMENT_TYPES = {
  hatarozatlan: "Határozatlan idejű",
  hatarozott: "Határozott idejű",
  reszmunkaido: "Részmunkaidős",
  megbizasi: "Megbízási jogviszony",
  diak: "Diákmunka",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

export const QUALIFICATION_KINDS = {
  vegzettseg: "Végzettség",
  kepesites: "Képesítés",
  igazolvany: "Igazolvány / engedély",
  jogositvany: "Jogosítvány",
  egyeb: "Egyéb jogosultság",
} as const;
export type QualificationKind = keyof typeof QUALIFICATION_KINDS;

export const EXIT_REASONS = {
  munkavallaloi_felmondas: "Munkavállalói felmondás",
  munkaltatoi_felmondas: "Munkáltatói felmondás",
  kozos_megegyezes: "Közös megegyezés",
  hatarozott_lejart: "Határozott idő lejárta",
  probaido: "Próbaidő alatti megszüntetés",
  azonnali: "Azonnali hatályú megszüntetés",
  nyugdij: "Nyugdíjba vonulás",
  egyeb: "Egyéb",
} as const;
export type ExitReason = keyof typeof EXIT_REASONS;

export const isStatus = (value: string): value is EmployeeStatus => Object.hasOwn(EMPLOYEE_STATUS, value);
export const isEmploymentType = (value: string): value is EmploymentType => Object.hasOwn(EMPLOYMENT_TYPES, value);
export const isQualificationKind = (value: string): value is QualificationKind => Object.hasOwn(QUALIFICATION_KINDS, value);
export const isExitReason = (value: string): value is ExitReason => Object.hasOwn(EXIT_REASONS, value);

/** Gyakori munkakörök a választólista javaslataihoz (a már rögzítettek mellé). */
export const POSITION_SUGGESTIONS = [
  "Vagyonőr",
  "Biztonsági őr",
  "Személy- és vagyonőr",
  "Objektumvezető",
  "Műszakvezető",
  "Recepciós biztonsági őr",
  "Járőr",
  "Diszpécser",
  "Területi koordinátor",
  "Irodai munkatárs",
];

/* ---------- Adatmodell (kliensoldalon is használt részei) ---------- */

export type Qualification = {
  id: string;
  kind: QualificationKind;
  name: string;
  /** Okmány- vagy bizonyítványszám. */
  number?: string;
  /** ÉÉÉÉ-HH-NN */
  issuedAt?: string;
  /** ÉÉÉÉ-HH-NN – ha van, a lejárat figyelése ebből történik. */
  expiresAt?: string;
  note?: string;
};

/** Bizalmas adatok: csak titkosítva kerülnek az adatbázisba (`secret` mező). */
export type EmployeeSecret = {
  birthName?: string;
  birthPlace?: string;
  birthDate?: string;
  motherName?: string;
  address?: string;
  taxId?: string;
  tajNumber?: string;
  bankAccount?: string;
  /** Bruttó alapbér forintban. */
  salary?: number;
  salaryType?: "havi" | "oraber";
};

export const SECRET_LABELS: Record<keyof EmployeeSecret, string> = {
  birthName: "Születési név",
  birthPlace: "Születési hely",
  birthDate: "Születési idő",
  motherName: "Anyja neve",
  address: "Lakcím",
  taxId: "Adóazonosító jel",
  tajNumber: "TAJ-szám",
  bankAccount: "Bankszámlaszám",
  salary: "Bruttó alapbér",
  salaryType: "Bérforma",
};

/* ---------- Lejárat-figyelés ---------- */

export type ExpiryKind = "orvosi" | "vagyonor" | "kepesites" | "szerzodes" | "probaido" | "kepzes";

export const EXPIRY_KINDS: Record<ExpiryKind, string> = {
  orvosi: "Orvosi alkalmasság",
  vagyonor: "Vagyonőri igazolvány",
  kepesites: "Képesítés, jogosultság",
  szerzodes: "Határozott szerződés vége",
  probaido: "Próbaidő vége",
  kepzes: "Képzési tanúsítvány",
};

export type Expiry = {
  employeeId: string;
  employeeName: string;
  kind: ExpiryKind;
  label: string;
  date: string;
  daysLeft: number;
};

type ExpirySource = {
  id: string;
  name: string;
  status: EmployeeStatus;
  medicalExpiry?: string;
  guardLicenseExpiry?: string;
  contractEnd?: string;
  probationEnd?: string;
  qualifications?: Qualification[];
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** A budapesti mai nap ÉÉÉÉ-HH-NN formában (a dates.ts-sel azonos). */
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** Egy dolgozó figyelendő dátumai (a lejártak is, negatív napszámmal). */
export function expiriesOf(employee: ExpirySource, today = todayKey()): Expiry[] {
  if (employee.status === "kilepett") return [];
  const base = { employeeId: employee.id, employeeName: employee.name };
  const items: Expiry[] = [];
  const push = (kind: Expiry["kind"], label: string, date?: string) => {
    if (date) items.push({ ...base, kind, label, date, daysLeft: daysBetween(today, date) });
  };
  push("orvosi", "Foglalkozás-egészségügyi alkalmasság", employee.medicalExpiry);
  push("vagyonor", "Vagyonőri igazolvány", employee.guardLicenseExpiry);
  push("szerzodes", "Határozott idejű szerződés vége", employee.contractEnd);
  push("probaido", "Próbaidő vége", employee.probationEnd);
  for (const qualification of employee.qualifications ?? []) push("kepesites", qualification.name, qualification.expiresAt);
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

export const expiryTone = (daysLeft: number) => (daysLeft < 0 ? "error" : daysLeft <= 30 ? "warning" : "muted") as "error" | "warning" | "muted";
export const expiryText = (daysLeft: number) => (daysLeft < 0 ? `${-daysLeft} napja lejárt` : daysLeft === 0 ? "ma jár le" : `${daysLeft} nap múlva`);

/* ---------- Dátumok ---------- */

const dateLabel = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

/** ÉÉÉÉ-HH-NN → „2026. márc. 1.”; üres értékre gondolatjel. */
export function formatDate(key?: string) {
  if (!key) return "–";
  const time = Date.parse(`${key}T12:00:00Z`);
  return Number.isNaN(time) ? key : dateLabel.format(new Date(time));
}

/** ÉÉÉÉ-HH-NN → „2026.03.01.” (a magyar Excel ezt dátumként ismeri fel). */
export const csvDate = (key?: string) => (key ? `${key.replaceAll("-", ".")}.` : "");

/**
 * Rugalmas dátumértelmezés: 2026.03.01, 2026-03-01, 2026.03.01., 2026. 03. 01., 2026/3/1, valamint 01.03.2026.
 * Érvénytelen naptári napra `null`.
 */
export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim().replace(/\.$/, "");
  let year: number, month: number, day: number;
  let match = /^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})$/.exec(value);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{4})$/.exec(value);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900 || year > 2200) return null;
  return date.toISOString().slice(0, 10);
}

/** Kis- és nagybetű, ékezet és írásjel nélküli alak (fejlécek, nevek összevetéséhez). */
export const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

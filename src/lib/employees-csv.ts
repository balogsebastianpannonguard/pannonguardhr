import "server-only";
import { EMAIL } from "@/lib/form";
import {
  EMPLOYEE_STATUS,
  EMPLOYMENT_TYPES,
  EXIT_REASONS,
  csvDate,
  normalizeKey,
  parseFlexibleDate,
  type EmployeeStatus,
  type EmploymentType,
} from "@/lib/employee-meta";
import type { Employee } from "@/lib/employees";

/**
 * CSV-export és -import a magyar Excelhez: UTF-8 BOM, pontosvessző elválasztó, „2026.03.01.” dátumok.
 * Csak nem bizalmas mezők: bér, azonosítók, lakcím és születési adatok soha nem kerülnek bele.
 */

type Column = { header: string; aliases: string[]; value: (employee: Employee) => string };

const COLUMNS = {
  name: { header: "Név", aliases: ["nev", "teljesnev", "munkavallalo", "dolgozo", "dolgozoneve", "munkavallaloneve"], value: (e) => e.name },
  email: { header: "E-mail", aliases: ["email", "emailcim", "mail"], value: (e) => e.email ?? "" },
  phone: { header: "Telefon", aliases: ["telefon", "telefonszam", "mobil", "mobilszam", "tel"], value: (e) => e.phone ?? "" },
  position: { header: "Munkakör", aliases: ["munkakor", "beosztas", "pozicio", "munkakormegnevezese"], value: (e) => e.position },
  department: {
    header: "Egység/Objektum",
    aliases: ["egysegobjektum", "egyseg", "objektum", "telephely", "szervezetiegyseg", "reszleg"],
    value: (e) => e.department ?? "",
  },
  manager: { header: "Vezető", aliases: ["vezeto", "kozvetlenvezeto", "felettes"], value: (e) => e.manager ?? "" },
  status: { header: "Állapot", aliases: ["allapot", "statusz"], value: (e) => EMPLOYEE_STATUS[e.status] },
  employmentType: {
    header: "Jogviszony",
    aliases: ["jogviszony", "foglalkoztatas", "foglalkoztatasjellege", "jogviszonytipusa", "munkaviszonytipusa"],
    value: (e) => EMPLOYMENT_TYPES[e.employmentType],
  },
  startDate: {
    header: "Belépés",
    aliases: ["belepes", "belepesnapja", "belepesdatuma", "munkaviszonykezdete", "kezdes", "munkabaallas"],
    value: (e) => csvDate(e.startDate),
  },
  probationEnd: { header: "Próbaidő vége", aliases: ["probaidovege", "probaido"], value: (e) => csvDate(e.probationEnd) },
  contractEnd: {
    header: "Határozott idő vége",
    aliases: ["hatarozottidovege", "szerzodesvege", "szerzodeslejarata"],
    value: (e) => csvDate(e.contractEnd),
  },
  weeklyHours: { header: "Heti óraszám", aliases: ["hetioraszam", "heti", "oraszam", "hetimunkaido"], value: (e) => (e.weeklyHours ? String(e.weeklyHours) : "") },
  education: { header: "Végzettség", aliases: ["vegzettseg", "iskolaivegzettseg", "legmagasabbvegzettseg"], value: (e) => e.education ?? "" },
  medicalExpiry: {
    header: "Orvosi alkalmasság lejárata",
    aliases: ["orvosialkalmassaglejarata", "orvosialkalmassag", "orvosi", "orvosilejarat", "orvosialkalmassagervenyessege", "alkalmassag"],
    value: (e) => csvDate(e.medicalExpiry),
  },
  guardLicenseNumber: {
    header: "Vagyonőri igazolvány száma",
    aliases: ["vagyonoriigazolvanyszama", "vagyonoriigazolvany", "igazolvanyszam", "vagyonoriszam"],
    value: (e) => e.guardLicenseNumber ?? "",
  },
  guardLicenseExpiry: {
    header: "Vagyonőri igazolvány lejárata",
    aliases: ["vagyonoriigazolvanylejarata", "igazolvanylejarata", "vagyonorilejarat"],
    value: (e) => csvDate(e.guardLicenseExpiry),
  },
  notes: { header: "Megjegyzés", aliases: ["megjegyzes", "megjegyzesek"], value: (e) => e.notes ?? "" },
} satisfies Record<string, Column>;

type Field = keyof typeof COLUMNS;

const EXPORT_EXTRA: Column[] = [
  { header: "Kilépés", aliases: [], value: (e) => csvDate(e.exitDate) },
  { header: "Kilépés oka", aliases: [], value: (e) => (e.exitReason ? EXIT_REASONS[e.exitReason] : "") },
];

/** Excel-képletként értelmezhető cellák semlegesítése (CSV-injekció ellen); a „+36 30 …” telefonszám marad. */
function safeCell(value: string) {
  const clean = value.replace(/\r?\n/g, " ");
  const risky = /^[=@\t\r]/.test(clean) || (/^[+-]/.test(clean) && !/^[+-][\d\s()/.-]*$/.test(clean));
  const cell = risky ? `'${clean}` : clean;
  return /[;"\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

const BOM = "﻿";
const line = (cells: string[]) => cells.map(safeCell).join(";");

export function employeesCsv(list: Employee[]) {
  const columns = [...Object.values(COLUMNS), ...EXPORT_EXTRA];
  return BOM + [line(columns.map((column) => column.header)), ...list.map((employee) => line(columns.map((column) => column.value(employee))))].join("\r\n") + "\r\n";
}

/** Üres importsablon egy kitöltött példasorral (a példasort az import kihagyja, ha nem törlöd). */
export function templateCsv() {
  const headers = Object.values(COLUMNS).map((column) => column.header);
  const example = [
    "Minta Mária",
    "minta.maria@example.com",
    "+36 30 123 4567",
    "Vagyonőr",
    "Központi iroda",
    "",
    "Aktív",
    "Határozatlan idejű",
    "2026.03.01.",
    "2026.05.30.",
    "",
    "40",
    "Érettségi",
    "2027.02.28.",
    "12345678",
    "2030.03.01.",
    "PÉLDASOR – töröld vagy írd felül",
  ];
  return BOM + [line(headers), line(example)].join("\r\n") + "\r\n";
}

/* ---------- Import ---------- */

/** Bájtok → szöveg: UTF-8, ha érvényes; különben a magyar Excel alapértelmezett Windows-1250 kódolása. */
export function decodeCsv(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** Idézőjeleket kezelő CSV-bontás; az elválasztót (; , vagy tab) az első sorból ismeri fel. */
export function parseCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (char: string) => firstLine.split(char).length - 1;
  const delimiter = [";", "\t", ","].reduce((best, char) => (count(char) > count(best) ? char : best), ";");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

export type ImportCandidate = {
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department?: string;
  manager?: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  startDate?: string;
  probationEnd?: string;
  contractEnd?: string;
  weeklyHours?: number;
  education?: string;
  medicalExpiry?: string;
  guardLicenseNumber?: string;
  guardLicenseExpiry?: string;
  notes?: string;
};

export type ImportRow = { line: number; data: Partial<ImportCandidate>; errors: string[]; duplicate?: string };

const ALIAS: Record<string, Field> = Object.fromEntries(
  (Object.entries(COLUMNS) as [Field, Column][]).flatMap(([field, column]) => [normalizeKey(column.header), ...column.aliases].map((alias) => [alias, field])),
);

function statusOf(raw: string): EmployeeStatus | null {
  const key = normalizeKey(raw);
  if (!key) return "aktiv";
  if (key.startsWith("aktiv")) return "aktiv";
  if (key.startsWith("belep")) return "belepes";
  if (key.startsWith("szunet") || key.includes("gyed") || key.includes("tartos")) return "szunetel";
  if (key.startsWith("kilep")) return "kilepett";
  return null;
}

function employmentTypeOf(raw: string): EmploymentType | null {
  const key = normalizeKey(raw);
  if (!key) return "hatarozatlan";
  if (key.includes("hatarozatlan")) return "hatarozatlan";
  if (key.includes("hatarozott")) return "hatarozott";
  if (key.includes("resz")) return "reszmunkaido";
  if (key.includes("megbiz")) return "megbizasi";
  if (key.includes("diak")) return "diak";
  return null;
}

const DATE_FIELDS = ["startDate", "probationEnd", "contractEnd", "medicalExpiry", "guardLicenseExpiry"] as const;
const TEXT_LIMITS: Partial<Record<Field, number>> = { name: 120, email: 160, phone: 40, position: 80, department: 120, manager: 120, education: 160, guardLicenseNumber: 40, notes: 2000 };

/**
 * A táblázat sorait munkavállalói adatokká alakítja. Az oszlopokat a fejléc magyar neve alapján (kis- és nagybetű,
 * ékezet nélkül) azonosítja; az ismeretlen oszlopokat figyelmen kívül hagyja.
 */
export function mapImportRows(rows: string[][]) {
  const [header = [], ...body] = rows;
  const fields = header.map((title) => ALIAS[normalizeKey(title)] as Field | undefined);
  const known = [...new Set(fields.filter((field): field is Field => Boolean(field)))];
  const ignored = header.filter((_, index) => !fields[index]).map((title) => title.trim()).filter(Boolean);
  if (!known.includes("name")) return { error: "Nem találom a „Név” oszlopot. Az első sor legyen a fejléc (pl. Név; E-mail; Munkakör …).", rows: [], known, ignored };

  const result: ImportRow[] = body.map((cells, rowIndex) => {
    const raw: Partial<Record<Field, string>> = {};
    fields.forEach((field, index) => {
      if (field && raw[field] === undefined) raw[field] = (cells[index] ?? "").trim().replace(/^'/, "").replace(/\s+/g, " ");
    });
    const errors: string[] = [];
    const data: Partial<ImportCandidate> = {};
    for (const [field, value] of Object.entries(raw) as [Field, string][]) {
      if (value && TEXT_LIMITS[field] && value.length > TEXT_LIMITS[field]) errors.push(`${COLUMNS[field].header}: túl hosszú.`);
    }
    const textValue = (field: Field) => raw[field]?.slice(0, TEXT_LIMITS[field] ?? 200) || undefined;

    data.name = textValue("name");
    if (!data.name || data.name.length < 2) errors.push("Hiányzik a név.");
    data.position = textValue("position") ?? "";
    if (!data.position) errors.push("Hiányzik a munkakör.");
    const email = raw.email?.toLowerCase();
    if (email) {
      if (EMAIL.test(email)) data.email = email;
      else errors.push(`Hibás e-mail-cím: ${email}`);
    }
    data.phone = textValue("phone");
    data.department = textValue("department");
    data.manager = textValue("manager");
    data.education = textValue("education");
    data.guardLicenseNumber = textValue("guardLicenseNumber");
    data.notes = textValue("notes");

    const status = statusOf(raw.status ?? "");
    if (status) data.status = status;
    else errors.push(`Ismeretlen állapot: ${raw.status}`);
    const type = employmentTypeOf(raw.employmentType ?? "");
    if (type) data.employmentType = type;
    else errors.push(`Ismeretlen jogviszony: ${raw.employmentType}`);

    for (const field of DATE_FIELDS) {
      const value = raw[field];
      if (!value) continue;
      const parsed = parseFlexibleDate(value);
      if (parsed) data[field] = parsed;
      else errors.push(`${COLUMNS[field].header}: „${value}” nem értelmezhető dátum (pl. 2026.03.01.).`);
    }
    if (raw.weeklyHours) {
      const hours = Number(raw.weeklyHours.replace(",", "."));
      if (Number.isFinite(hours) && hours > 0 && hours <= 60) data.weeklyHours = hours;
      else errors.push(`Heti óraszám: „${raw.weeklyHours}” nem 1 és 60 közötti szám.`);
    }
    if (data.notes?.startsWith("PÉLDASOR")) errors.push("Ez a sablon példasora – töröld, vagy írd felül a saját adatokkal.");
    return { line: rowIndex + 2, data, errors };
  });
  return { rows: result, known, ignored };
}

export const IMPORT_HEADERS = Object.values(COLUMNS).map((column) => column.header);

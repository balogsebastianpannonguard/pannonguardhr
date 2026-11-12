import "server-only";
import { createHash, createHmac } from "node:crypto";
import { ObjectId, type AnyBulkWriteOperation } from "mongodb";
import { APPSHEET_BY_HEADER, APPSHEET_BY_ID, APPSHEET_COLUMNS } from "@/lib/appsheet-meta";
import { openData, sealData } from "@/lib/data-box";
import { dayKey } from "@/lib/dates";
import type { EmployeeSecret, Qualification } from "@/lib/employee-meta";
import { employees, readSecret, sealSecret, type AppsheetData, type EmployeeDocument } from "@/lib/employees";
import { hrLog, type HrLogEntry } from "@/lib/hr-log";
import { getDb } from "@/lib/mongodb";

/*
 * Az AppSheet-ből exportált munkatársi nyilvántartás betöltése.
 *
 * Alapelvek:
 *  - Minden cella betűre pontosan (szóközökkel, sortörésekkel, nem törő szóközzel együtt) eltárolódik; a bizalmas
 *    oszlopok titkosítva. Ebből a fájl bájtra azonosan visszaállítható (lásd `appsheetCsv`), és az import végén
 *    a rendszer vissza is olvassa és cellánként összeveti a fájllal.
 *  - Az adatot nem „javítjuk”: a gyanús értékeket (pl. elveszett kezdő 0 a TAJ-számban, hibás ellenőrző szám)
 *    csak megjelöljük ellenőrzésre.
 *  - Az import megismételhető: a munkatárs az AppSheet sorazonosítója alapján frissül, nem duplikálódik.
 *  - Az AppSheet-adatokból a HR-rendszer saját mezői is kitöltődnek (név, cég, munkakör, egység, belépés,
 *    orvosi alkalmasság, igazolványok…), így a lejárat-figyelés, a dokumentumok és a kimutatások is látják őket.
 */

/* ---------- CSV: bájtpontos bontás és visszaírás ---------- */

export type CsvFormat = { bom: boolean; eol: "\n" | "\r\n"; trailingEol: boolean; delimiter: string };

export function decodeExact(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** RFC 4180 szerinti bontás, semmit nem vág le és nem hagy el (az idézett mezőkben a sortörés is megmarad). */
export function parseExact(input: string): { rows: string[][]; format: CsvFormat } {
  const bom = input.startsWith("﻿");
  const text = bom ? input.slice(1) : input;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].reduce((best, char) => (firstLine.split(char).length > firstLine.split(best).length ? char : best), ";");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let eol: CsvFormat["eol"] | undefined;
  let index = 0;
  for (; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      const crlf = char === "\r" && text[index + 1] === "\n";
      eol ??= crlf ? "\r\n" : "\n";
      if (crlf) index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  const trailingEol = row.length === 0 && cell === "";
  if (!trailingEol) {
    row.push(cell);
    rows.push(row);
  }
  return { rows, format: { bom, eol: eol ?? "\r\n", trailingEol, delimiter } };
}

/** Az AppSheet minden mezőt idézőjelbe tesz – kivéve a fejléc nélküli, üres oszlopot. */
function quote(value: string, header: string) {
  if (header === "" && value === "") return "";
  return `"${value.replaceAll('"', '""')}"`;
}

export function serializeExact(headers: string[], rows: string[][], format: CsvFormat) {
  const lines = [headers, ...rows].map((cells) => cells.map((value, index) => quote(value, headers[index] ?? "")).join(format.delimiter));
  return (format.bom ? "﻿" : "") + lines.join(format.eol) + (format.trailingEol ? format.eol : "");
}

/* ---------- Dátumok és ellenőrzések ---------- */

/** „2026. 03. 01.” (és „2026.03.01.”, „2026-03-01”) → „2026-03-01”; érvénytelen naptári napra null. */
export function appsheetDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const digits = (value: string) => value.replace(/\D/g, "");

const tajValid = (d: string) => d.length === 9 && [...d.slice(0, 8)].reduce((sum, c, i) => sum + Number(c) * (i % 2 === 0 ? 3 : 7), 0) % 10 === Number(d[8]);
const taxValid = (d: string) => d.length === 10 && d[0] === "8" && [...d.slice(0, 9)].reduce((sum, c, i) => sum + Number(c) * (i + 1), 0) % 11 === Number(d[9]);
const giroBlock = (block: string) => [...block].reduce((sum, c, i) => sum + Number(c) * [9, 7, 3, 1][i % 4], 0) % 10 === 0;
/** Az adóazonosító jel 2–6. számjegye: az 1867. január 1. óta eltelt napok száma a születés napjáig. */
const taxBirthMatches = (d: string, birth: string) => Number(d.slice(1, 6)) === Math.round((Date.parse(`${birth}T00:00:00Z`) - Date.UTC(1867, 0, 1)) / 86_400_000);

type Values = Record<string, string>;

/** Soronkénti adatellenőrzés. Az üzenetek soha nem tartalmazzák magát a bizalmas értéket. */
function rowIssues(v: Values): string[] {
  const issues: string[] = [];
  const birth = appsheetDate(v.szuletesiIdo ?? "");

  for (const column of APPSHEET_COLUMNS) {
    const value = v[column.id] ?? "";
    if (column.date && value.trim() && !appsheetDate(value)) issues.push(`„${column.header}”: nem értelmezhető dátum`);
  }

  const taj = digits(v.taj ?? "");
  if (!taj) issues.push("Hiányzik a TAJ-szám");
  else if (taj.length === 8 && tajValid(`0${taj}`)) issues.push("A TAJ-szám 8 számjegyű – egy kezdő 0-val érvényes lenne (valószínűleg a táblázatkezelő hagyta le)");
  else if (taj.length !== 9) issues.push(`A TAJ-szám nem 9 számjegyű (${taj.length})`);
  else if (!tajValid(taj)) issues.push("A TAJ-szám ellenőrző számjegye nem stimmel");

  const tax = digits(v.adoazonosito ?? "");
  if (!tax) issues.push("Hiányzik az adóazonosító jel");
  else if (tax.length !== 10 || tax[0] !== "8") issues.push(`Az adóazonosító jel nem 10 számjegyű, 8-cal kezdődő szám (${tax.length} számjegy)`);
  else if (!taxValid(tax)) issues.push("Az adóazonosító jel ellenőrző számjegye hibás");
  else if (birth && !taxBirthMatches(tax, birth)) issues.push("Az adóazonosító jel nem egyezik a születési idővel");

  const bank = digits(v.szamlaszam ?? "");
  if (bank) {
    if (bank.length !== 16 && bank.length !== 24) issues.push(`A számlaszám nem 16 vagy 24 számjegyű (${bank.length})`);
    else if (!giroBlock(bank.slice(0, 8)) || !giroBlock(bank.slice(8))) issues.push("A számlaszám ellenőrző számjegye hibás");
  }

  const personal = (v.szemelyiSzam ?? "").trim();
  if (personal) {
    const d = digits(personal);
    if (d.length !== 11 || /[a-z]/i.test(personal)) issues.push("A személyi szám formátuma szokatlan (11 számjegy az elvárt)");
    else if ("1234".includes(d[0])) {
      if (birth && d.slice(1, 7) !== birth.slice(2).replaceAll("-", "")) issues.push("A személyi szám nem egyezik a születési idővel");
      const male = d[0] === "1" || d[0] === "3";
      if (v.neme === "Férfi" ? !male : v.neme === "Nő" ? male : false) issues.push("A személyi szám nem egyezik a nemmel");
    }
  }

  for (const n of [1, 2, 3, 4]) {
    const childTax = digits(v[`gyerek${n}Ado`] ?? "");
    const childBirth = appsheetDate(v[`gyerek${n}Szul`] ?? "");
    if (!childTax) continue;
    if (childTax.length !== 10 || childTax[0] !== "8") issues.push(`${n}. gyermek: az adóazonosító jel nem 10 számjegyű (${childTax.length})`);
    else if (!taxValid(childTax)) issues.push(`${n}. gyermek: az adóazonosító jel ellenőrző számjegye hibás`);
    else if (childBirth && !taxBirthMatches(childTax, childBirth)) issues.push(`${n}. gyermek: az adóazonosító jel nem egyezik a születési idővel`);
  }

  const email = (v.email ?? "").trim();
  if (email && !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(email)) issues.push("Az e-mail-cím formátuma hibás");
  if ((v.fullName ?? "") !== `${v.vezeteknev ?? ""} ${v.keresztnev ?? ""}`) issues.push("A „Full Name” eltér a vezeték- és keresztnévtől");
  return issues;
}

/** Ugyanaz az azonosító több sorban (pl. ugyanaz a TAJ-szám két különböző munkatársnál). */
function duplicateIssues(records: { row: number; values: Values }[]) {
  const checks: [string, string][] = [
    ["taj", "TAJ-szám"],
    ["adoazonosito", "adóazonosító jel"],
    ["szigSzam", "személyi igazolvány szám"],
    ["szamlaszam", "számlaszám"],
    ["vagyonorIgazolvany", "vagyonőri igazolvány szám"],
  ];
  const result = new Map<number, string[]>();
  for (const [id, label] of checks) {
    const seen = new Map<string, number[]>();
    for (const { row, values } of records) {
      const key = id === "szigSzam" || id === "vagyonorIgazolvany" ? (values[id] ?? "").replace(/\s/g, "").toUpperCase() : digits(values[id] ?? "");
      if (key) seen.set(key, [...(seen.get(key) ?? []), row]);
    }
    for (const rows of seen.values()) {
      if (rows.length < 2) continue;
      for (const row of rows) {
        const others = rows.filter((other) => other !== row).map((other) => `${other}.`).join(", ");
        result.set(row, [...(result.get(row) ?? []), `Ugyanez a ${label} a(z) ${others} sorban is szerepel`]);
      }
    }
  }
  return result;
}

/* ---------- Sorok → munkatársak ---------- */

const identityKey = () => {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("A DATA_ENCRYPTION_KEY hiányzik vagy hibás.");
  return Buffer.from(hex, "hex");
};

/** Kulcsolt lenyomat a név + születési idő + cég + belépés négyesről (visszafejthetetlen, csak egyeztetésre). */
const identityOf = (v: Values) =>
  createHmac("sha256", identityKey())
    .update(["appsheet-identity", v.vezeteknev, v.keresztnev, v.szuletesiIdo, v.ceg, v.belepes].map((part) => (part ?? "").trim()).join("\u0001"))
    .digest("hex");

/** Az AppSheet sorazonosítója: a „History” első tagja (pl. „k3f9x0a2”); ha nincs, a kulcsolt lenyomat. */
function rowKey(v: Values) {
  const first = (v.history ?? "").split(",")[0].trim();
  return /^[0-9a-z]{8}$/i.test(first) ? first : `azon:${identityOf(v).slice(0, 20)}`;
}

type Parsed = {
  row: number;
  cells: string[];
  values: Values;
  extra: Record<string, string>;
  key: string;
  identity: string;
  hash: string;
  issues: string[];
};

export type AppsheetFile = { headers: string[]; format: CsvFormat; rows: Parsed[]; exactFormat: boolean; unknownHeaders: string[]; text: string };

export function readAppsheetFile(bytes: Uint8Array): { file?: AppsheetFile; error?: string } {
  const text = decodeExact(bytes);
  const { rows, format } = parseExact(text);
  const [headers, ...data] = rows;
  if (!headers || data.length === 0) return { error: "A fájlban nincs adatsor a fejléc alatt." };
  const missing = APPSHEET_COLUMNS.filter((column) => !headers.includes(column.header)).map((column) => `„${column.header}”`);
  if (missing.length) return { error: `Ez nem a megszokott AppSheet-export: hiányzó oszlop(ok): ${missing.join(", ")}.` };
  const repeated = headers.filter((header, index) => header !== "" && headers.indexOf(header) !== index);
  if (repeated.length) return { error: `Ismétlődő oszlopnév a fejlécben: ${repeated.join(", ")}.` };
  const wrong = data.map((cells, index) => [index + 1, cells.length] as const).filter(([, length]) => length !== headers.length);
  if (wrong.length) return { error: `${wrong.length} sor oszlopszáma eltér a fejléctől (pl. a(z) ${wrong[0][0]}. sor: ${wrong[0][1]} oszlop a ${headers.length} helyett). Az importot nem indítom el, mert így nem lenne pontos.` };

  const parsed: Parsed[] = data.map((cells, index) => {
    const values: Values = {};
    const extra: Record<string, string> = {};
    cells.forEach((value, column) => {
      const known = APPSHEET_BY_HEADER.get(headers[column]);
      if (known) values[known.id] = value;
      else if (value !== "") extra[String(column)] = value;
    });
    return {
      row: index + 1,
      cells,
      values,
      extra,
      key: rowKey(values),
      identity: identityOf(values),
      hash: createHash("sha256").update(JSON.stringify(cells)).digest("hex"),
      issues: rowIssues(values),
    };
  });

  // Ugyanaz a sorazonosító kétszer: a második a kulcsolt lenyomatot kapja, hogy egyik sor se vesszen el.
  const keys = new Set<string>();
  for (const record of parsed) {
    if (keys.has(record.key)) {
      record.key = `azon:${record.identity.slice(0, 20)}:${record.row}`;
      record.issues.push("Az AppSheet sorazonosítója (History) egy másik sorban is szerepel");
    }
    keys.add(record.key);
  }
  for (const [row, issues] of duplicateIssues(parsed)) parsed[row - 1].issues.push(...issues);

  const exactFormat = serializeExact(headers, data, format) === text;
  const unknownHeaders = headers.filter((header) => !APPSHEET_BY_HEADER.has(header)).map((header) => header || "(névtelen oszlop)");
  return { file: { headers, format, rows: parsed, exactFormat, unknownHeaders, text } };
}

/** Az AppSheet-sorból a HR-rendszer saját mezői. */
function derive(v: Values, today: string) {
  const trim = (id: string) => (v[id] ?? "").trim() || undefined;
  const startDate = appsheetDate(v.belepes ?? "") ?? undefined;
  const exitDate = appsheetDate(v.kilepesDatuma ?? "") ?? undefined;
  const status: EmployeeDocument["status"] = exitDate && exitDate <= today ? "kilepett" : startDate && startDate > today ? "belepes" : "aktiv";
  const qualifications: Qualification[] = [];
  const certificate = trim("tanusitvanySzam");
  const certificateExpiry = appsheetDate(v.tanusitvanyErvenyesseg ?? "") ?? undefined;
  if (certificate || certificateExpiry)
    qualifications.push({ id: "appsheet-tanbiz", kind: "kepesites", name: "Tanúsítvány / bizonyítvány (AppSheet)", number: certificate, expiresAt: certificateExpiry });
  const idCardExpiry = appsheetDate(v.szigErvenyesseg ?? "") ?? undefined;
  if (idCardExpiry) qualifications.push({ id: "appsheet-szig", kind: "igazolvany", name: "Személyi igazolvány", expiresAt: idCardExpiry });

  const fields = {
    name: trim("fullName") ?? [v.vezeteknev, v.keresztnev].map((part) => (part ?? "").trim()).filter(Boolean).join(" "),
    company: trim("ceg"),
    email: trim("email")?.toLowerCase(),
    phone: trim("telefon"),
    position: trim("munkakor") ?? "",
    department: trim("szervezetiEgyseg"),
    status,
    employmentType: /részmunka/i.test(v.munkaJellege ?? "") ? "reszmunkaido" : "hatarozatlan",
    startDate,
    exitDate: status === "kilepett" ? exitDate : undefined,
    education: trim("vegzettseg"),
    medicalExpiry: appsheetDate(v.orvosi ?? "") ?? undefined,
    guardLicenseNumber: trim("vagyonorIgazolvany"),
    notes: (v.megjegyzes ?? "").trim() ? v.megjegyzes : undefined,
  } satisfies Partial<EmployeeDocument>;

  const taj = digits(v.taj ?? "");
  const secret: EmployeeSecret = {
    birthName: trim("szuletesiNev"),
    birthPlace: trim("szuletesiHely"),
    birthDate: appsheetDate(v.szuletesiIdo ?? "") ?? undefined,
    motherName: trim("anyjaNeve"),
    address: trim("lakohely"),
    taxId: digits(v.adoazonosito ?? "") || undefined,
    tajNumber: taj.length === 9 ? `${taj.slice(0, 3)} ${taj.slice(3, 6)} ${taj.slice(6)}` : trim("taj"),
    bankAccount: trim("szamlaszam"),
  };
  return { fields, qualifications, secret };
}

/** Az AppSheet-adatlap tárolt alakja: a nem bizalmas cellák nyíltan, a többi (és az ismeretlen oszlopok) titkosítva. */
function storedRecord(record: Parsed, importId: ObjectId, importedAt: Date, file: string): AppsheetData {
  const plain: Record<string, string> = {};
  const hidden: Record<string, string> = {};
  for (const [id, value] of Object.entries(record.values)) {
    if (value === "") continue;
    if (APPSHEET_BY_ID.get(id)?.secret) hidden[id] = value;
    else plain[id] = value;
  }
  for (const [column, value] of Object.entries(record.extra)) hidden[`x:${column}`] = value;
  return {
    key: record.key,
    identity: record.identity,
    row: record.row,
    hash: record.hash,
    plain,
    secret: Object.keys(hidden).length ? sealData(hidden) : undefined,
    issues: record.issues,
    importId,
    importedAt,
    file,
  };
}

/** A tárolt adatlapból visszaállított cellák a fájl fejlécének sorrendjében. */
export function cellsFromStored(data: Pick<AppsheetData, "plain" | "secret">, headers: string[]) {
  const hidden = openData<Record<string, string>>(data.secret, {});
  return headers.map((header, column) => {
    const known = APPSHEET_BY_HEADER.get(header);
    if (!known) return hidden[`x:${column}`] ?? "";
    return (known.secret ? hidden[known.id] : data.plain[known.id]) ?? "";
  });
}

export function openAppsheetSecret(data: Pick<AppsheetData, "secret">) {
  return openData<Record<string, string>>(data.secret, {});
}

/* ---------- Előnézet és betöltés ---------- */

export type AppsheetSummary = {
  file: string;
  rows: number;
  columns: number;
  cells: number;
  unknownHeaders: string[];
  exactFormat: boolean;
  created: number;
  updated: number;
  unchanged: number;
  missing: number;
  companies: [string, number][];
  issueRows: number;
  issueCount: number;
  issues: { row: number; name: string; issues: string[] }[];
  changes: { row: number; name: string; columns: string[] }[];
  verified?: { rows: number; cells: number; mismatches: number; exactBytes: boolean };
};

export type AppsheetImport = {
  _id: ObjectId;
  file: string;
  size: number;
  sha256: string;
  headers: string[];
  format: CsvFormat;
  rows: number;
  at: Date;
  by: string;
  byName: string;
  result: Pick<AppsheetSummary, "created" | "updated" | "unchanged" | "missing" | "issueRows" | "verified">;
};

export const appsheetImports = async () => (await getDb()).collection<AppsheetImport>("appsheet_imports");

async function existingRecords() {
  return (await employees()).find({ appsheet: { $exists: true } }).toArray();
}

type Plan = { record: Parsed; match?: EmployeeDocument }[];

function plan(file: AppsheetFile, existing: EmployeeDocument[]) {
  const byKey = new Map(existing.map((doc) => [doc.appsheet!.key, doc]));
  const byIdentity = new Map(existing.map((doc) => [doc.appsheet!.identity, doc]));
  const used = new Set<string>();
  const steps: Plan = file.rows.map((record) => {
    let match = byKey.get(record.key);
    if (!match || used.has(String(match._id))) {
      const candidate = byIdentity.get(record.identity);
      match = candidate && !used.has(String(candidate._id)) ? candidate : undefined;
    }
    if (match) used.add(String(match._id));
    return { record, match };
  });
  const missing = existing.filter((doc) => !used.has(String(doc._id)));
  return { steps, missing };
}

function summarize(fileName: string, file: AppsheetFile, steps: Plan, missing: EmployeeDocument[]): AppsheetSummary {
  const companies = new Map<string, number>();
  for (const { record } of steps) companies.set(record.values.ceg || "(nincs megadva)", (companies.get(record.values.ceg || "(nincs megadva)") ?? 0) + 1);
  const name = (record: Parsed) => record.values.fullName || `${record.values.vezeteknev} ${record.values.keresztnev}`;
  const changes: AppsheetSummary["changes"] = [];
  let created = 0;
  let unchanged = 0;
  for (const { record, match } of steps) {
    if (!match) created++;
    else if (match.appsheet!.hash === record.hash) unchanged++;
    else {
      const before = cellsFromStoredSafe(match.appsheet!, file.headers);
      const columns = file.headers.filter((_, index) => before?.[index] !== record.cells[index]).map((header) => header || "(névtelen oszlop)");
      changes.push({ row: record.row, name: name(record), columns });
    }
  }
  const withIssues = steps.filter(({ record }) => record.issues.length);
  return {
    file: fileName,
    rows: file.rows.length,
    columns: file.headers.length,
    cells: file.rows.length * file.headers.length,
    unknownHeaders: file.unknownHeaders,
    exactFormat: file.exactFormat,
    created,
    updated: changes.length,
    unchanged,
    missing: missing.length,
    companies: [...companies].sort((a, b) => b[1] - a[1]),
    issueRows: withIssues.length,
    issueCount: withIssues.reduce((sum, { record }) => sum + record.issues.length, 0),
    issues: withIssues.map(({ record }) => ({ row: record.row, name: name(record), issues: record.issues })),
    changes,
  };
}

function cellsFromStoredSafe(data: AppsheetData, headers: string[]) {
  try {
    return cellsFromStored(data, headers);
  } catch {
    return null;
  }
}

export async function previewAppsheet(fileName: string, file: AppsheetFile) {
  const { steps, missing } = plan(file, await existingRecords());
  return summarize(fileName, file, steps, missing);
}

const strip = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;

export async function commitAppsheet(fileName: string, file: AppsheetFile, bytes: Uint8Array, user: { id: string; name: string }): Promise<AppsheetSummary> {
  const collection = await employees();
  const { steps, missing } = plan(file, await existingRecords());
  const summary = summarize(fileName, file, steps, missing);
  const importId = new ObjectId();
  const now = new Date();
  const today = dayKey(now);
  const operations: AnyBulkWriteOperation<EmployeeDocument>[] = [];
  const logs: HrLogEntry[] = [];

  for (const { record, match } of steps) {
    const appsheet = storedRecord(record, importId, now, fileName);
    const { fields, qualifications, secret } = derive(record.values, today);
    if (!match) {
      const _id = new ObjectId();
      operations.push({
        insertOne: {
          document: {
            _id,
            ...(strip(fields) as typeof fields),
            qualifications,
            secret: sealSecret(secret),
            appsheet: strip(appsheet) as AppsheetData,
            createdAt: now,
            updatedAt: now,
            createdBy: user.id,
            updatedBy: user.id,
          } as EmployeeDocument,
        },
      });
      logs.push({ at: now, by: user.id, byName: user.name, action: "employee.import", entity: "employee", entityId: String(_id), summary: `Felvéve az AppSheet-nyilvántartásból (${record.row}. sor)` });
      continue;
    }
    if (match.appsheet!.hash === record.hash) {
      operations.push({
        updateOne: {
          filter: { _id: match._id },
          update: {
            $set: {
              "appsheet.row": record.row,
              "appsheet.importId": importId,
              "appsheet.importedAt": now,
              "appsheet.file": fileName,
              "appsheet.key": record.key,
              "appsheet.issues": record.issues,
              // A korábban jövőbeli belépés azóta elérkezett.
              ...(match.status === "belepes" && match.startDate && match.startDate <= today && { status: "aktiv" as const }),
            },
            $unset: { "appsheet.missing": "" },
          },
        },
      });
      continue;
    }
    // Változott sor: az AppSheet az irányadó. A HR-ben rögzített kilépés és bér megmarad, ahogy a nem AppSheet-ből származó képesítések is.
    const keepExit = match.status === "kilepett" && fields.status !== "kilepett";
    const derived = keepExit ? { ...fields, status: match.status, exitDate: match.exitDate } : fields;
    const mergedSecret: EmployeeSecret = { ...readSecretSafe(match), ...secret };
    for (const key of Object.keys(secret) as (keyof EmployeeSecret)[]) if (secret[key] === undefined) delete mergedSecret[key];
    const sealedSecret = sealSecret(mergedSecret);
    const unset: Record<string, ""> = Object.fromEntries(
      [...Object.entries(derived).filter(([, value]) => value === undefined).map(([key]) => key), ...(sealedSecret ? [] : ["secret"]), ...(appsheet.secret ? [] : ["appsheet.secret"])].map((key) => [key, ""]),
    );
    operations.push({
      updateOne: {
        filter: { _id: match._id },
        update: {
          $set: {
            ...strip(derived),
            qualifications: [...(match.qualifications ?? []).filter((item) => !item.id.startsWith("appsheet-")), ...qualifications],
            ...(sealedSecret && { secret: sealedSecret }),
            appsheet: strip(appsheet) as AppsheetData,
            updatedAt: now,
            updatedBy: user.id,
          },
          ...(Object.keys(unset).length && { $unset: unset }),
        },
      },
    });
    const columns = summary.changes.find((change) => change.row === record.row)?.columns ?? [];
    logs.push({ at: now, by: user.id, byName: user.name, action: "employee.update", entity: "employee", entityId: String(match._id), summary: `AppSheet-frissítés: ${columns.join(", ")}`.slice(0, 200) });
  }
  for (const doc of missing) operations.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { "appsheet.missing": true } } } });

  if (operations.length) await collection.bulkWrite(operations, { ordered: true });

  // Visszaellenőrzés: minden sort visszaolvasunk, visszafejtünk, és cellánként összevetünk a feltöltött fájllal.
  const stored = await collection.find({ "appsheet.importId": importId }, { projection: { appsheet: 1 } }).toArray();
  const byRow = new Map(stored.map((doc) => [doc.appsheet!.row, doc.appsheet!]));
  let mismatches = 0;
  const rebuilt: string[][] = [];
  for (const record of file.rows) {
    const data = byRow.get(record.row);
    const cells = data ? cellsFromStored(data, file.headers) : file.headers.map(() => "\u0000");
    rebuilt.push(cells);
    cells.forEach((value, index) => {
      if (value !== record.cells[index]) mismatches++;
    });
  }
  const exactBytes = serializeExact(file.headers, rebuilt, file.format) === file.text;
  const verified = { rows: stored.length, cells: stored.length * file.headers.length, mismatches, exactBytes };

  await (await appsheetImports()).insertOne({
    _id: importId,
    file: fileName,
    size: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    headers: file.headers,
    format: file.format,
    rows: file.rows.length,
    at: now,
    by: user.id,
    byName: user.name,
    result: { created: summary.created, updated: summary.updated, unchanged: summary.unchanged, missing: summary.missing, issueRows: summary.issueRows, verified },
  });
  logs.push({
    at: now,
    by: user.id,
    byName: user.name,
    action: "appsheet.import",
    entity: "appsheet",
    entityId: String(importId),
    summary: `AppSheet-betöltés (${fileName}): ${summary.created} új, ${summary.updated} frissített, ${summary.unchanged} változatlan; ellenőrzés: ${mismatches} eltérés`.slice(0, 200),
  });
  if (logs.length) await (await hrLog()).insertMany(logs, { ordered: false });
  return { ...summary, verified };
}

function readSecretSafe(doc: EmployeeDocument): EmployeeSecret {
  try {
    return readSecret(doc);
  } catch {
    return {};
  }
}

/* ---------- Lekérdezések ---------- */

export async function latestAppsheetImport() {
  return (await appsheetImports()).find({}, { projection: { headers: 0 } }).sort({ at: -1 }).limit(1).next();
}

/** A legutóbbi betöltés bájtpontos visszaállítása a rendszerben tárolt adatokból. */
export async function appsheetCsv() {
  const last = await (await appsheetImports()).find().sort({ at: -1 }).limit(1).next();
  if (!last) return null;
  const docs = await (await employees()).find({ "appsheet.importId": last._id }, { projection: { appsheet: 1 } }).sort({ "appsheet.row": 1 }).toArray();
  const rows = docs.map((doc) => cellsFromStored(doc.appsheet!, last.headers));
  return { name: last.file, rows: rows.length, text: serializeExact(last.headers, rows, last.format) };
}

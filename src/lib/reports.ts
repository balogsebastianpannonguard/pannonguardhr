import "server-only";
import { absencesBetween, daysWithin } from "@/lib/absences";
import { ABSENCE_TYPES, eachDay, isWorkday, type AbsenceType } from "@/lib/absences-meta";
import { addDays, addMonths, dayKey, formatMonth } from "@/lib/dates";
import { employees, EXIT_REASONS, type ExitReason } from "@/lib/employees";
import { MONTH } from "@/lib/form";
import { trainingExpiries, trainingsBetween } from "@/lib/trainings";
import { TRAINING_TYPES, type TrainingType } from "@/lib/trainings-meta";

/* ---------- Időszak ---------- */

export const PERIODS = {
  ev: "Idei év",
  "12ho": "Elmúlt 12 hónap",
  elozo: "Előző év",
  egyedi: "Egyedi időszak",
} as const;
export type PeriodKey = keyof typeof PERIODS;

export type Period = {
  key: PeriodKey;
  /** ÉÉÉÉ-HH */
  fromMonth: string;
  toMonth: string;
  /** ÉÉÉÉ-HH-NN – az időszak első és utolsó (legfeljebb mai) napja. */
  start: string;
  end: string;
  months: string[];
  label: string;
  /** A linkekhez és az űrlaphoz. */
  query: string;
};

const lastDay = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

const monthsBetween = (from: string, to: string) => {
  const list: string[] = [];
  for (let month = from; month <= to && list.length < 120; month = addMonths(month, 1)) list.push(month);
  return list;
};

const monthName = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", month: "short" });
/** Rövid hónapcímke a diagramokhoz, pl. „jan.”, évváltásnál „2026 jan.”. */
export const shortMonth = (month: string, withYear = false) => `${withYear ? `${month.slice(0, 4)} ` : ""}${monthName.format(new Date(`${month}-15T12:00:00Z`))}`;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Az URL-paraméterekből (`idoszak`, `tol`, `ig`) érvényes időszak; a jövő hónapjai nem számítanak. */
export function resolvePeriod(params: Params, today = dayKey(new Date())): Period {
  const current = today.slice(0, 7);
  const year = today.slice(0, 4);
  const raw = one(params.idoszak);
  const key: PeriodKey = raw in PERIODS ? (raw as PeriodKey) : "ev";
  let fromMonth = `${year}-01`;
  let toMonth = current;
  if (key === "12ho") fromMonth = addMonths(current, -11);
  if (key === "elozo") {
    fromMonth = `${Number(year) - 1}-01`;
    toMonth = `${Number(year) - 1}-12`;
  }
  if (key === "egyedi") {
    const tol = one(params.tol);
    const ig = one(params.ig);
    if (MONTH.test(tol) && tol >= "2000-01") fromMonth = tol;
    if (MONTH.test(ig) && ig >= "2000-01") toMonth = ig;
    if (toMonth > current) toMonth = current;
    if (fromMonth > toMonth) fromMonth = toMonth;
    if (monthsBetween(fromMonth, toMonth).length > 60) fromMonth = addMonths(toMonth, -59);
  }
  const end = toMonth === current ? today : lastDay(toMonth);
  const months = monthsBetween(fromMonth, toMonth);
  const label =
    key === "egyedi" || key === "12ho"
      ? `${formatMonth(fromMonth)} – ${formatMonth(toMonth)}`
      : key === "elozo"
        ? `${Number(year) - 1}. év`
        : `${year}. január 1. – ma`;
  const query = new URLSearchParams({ idoszak: key, ...(key === "egyedi" && { tol: fromMonth, ig: toMonth }) }).toString();
  return { key, fromMonth, toMonth, start: `${fromMonth}-01`, end, months, label, query };
}

/* ---------- Összesítés ---------- */

export type Slice = { label: string; value: number };

export type ReportData = {
  period: Period;
  generatedAt: string;
  headcount: {
    opening: number;
    closing: number;
    average: number;
    joiners: number;
    leavers: number;
    /** Kilépők ÷ átlagos létszám × 100, egy tizedesre. */
    fluctuation: number;
    months: { month: string; headcount: number; joiners: number; leavers: number }[];
    byPosition: Slice[];
    byDepartment: Slice[];
    exitsByReason: Slice[];
  };
  absence: {
    totalDays: number;
    /** Távolléti munkanapok ÷ (átlagos létszám × munkanapok) × 100. */
    rate: number;
    workdays: number;
    byType: (Slice & { type: AbsenceType })[];
    byMonth: { month: string; values: Partial<Record<AbsenceType, number>> }[];
  };
  training: {
    held: number;
    participants: number;
    uniqueParticipants: number;
    passed: number;
    failed: number;
    /** Megfelelt ÷ vizsgázott × 100 (vizsga nélkül `null`). */
    passRate: number | null;
    cost: number;
    studyContracts: number;
    byType: (Slice & { type: TrainingType })[];
    expiring: number;
    expired: number;
  };
  quality: { missingStart: number; exitedWithoutDate: number };
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const toSlices = (map: Map<string, number>) =>
  [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "hu"));

/** Minden kimutatás egy időszakra: csak összesített számok, személyes adat nélkül. */
export async function buildReport(period: Period): Promise<ReportData> {
  const { start, end, months } = period;
  const [docs, absenceRows, trainingDocs, expiries] = await Promise.all([
    (await employees()).find({}, { projection: { status: 1, startDate: 1, exitDate: 1, exitReason: 1, position: 1, department: 1 } }).toArray(),
    absencesBetween(start, end),
    trainingsBetween(start, end),
    trainingExpiries(90),
  ]);

  /* Létszám: kezdőnap nélkül (és nem belépés alatt) „mindig is itt volt”; kilépett, de dátum nélkül: kimarad. */
  const people = docs.filter((doc) => (doc.startDate || doc.status !== "belepes") && !(doc.status === "kilepett" && !doc.exitDate));
  const present = (day: string) => people.filter((doc) => (!doc.startDate || doc.startDate <= day) && (!doc.exitDate || doc.exitDate >= day));
  const monthRows = months.map((month) => {
    const first = `${month}-01`;
    const last = month === period.toMonth ? end : lastDay(month);
    return {
      month,
      headcount: present(last).length,
      joiners: docs.filter((doc) => doc.startDate && doc.startDate >= first && doc.startDate <= last).length,
      leavers: docs.filter((doc) => doc.exitDate && doc.exitDate >= first && doc.exitDate <= last).length,
    };
  });
  const opening = present(addDays(start, -1)).length;
  const closingList = present(end);
  const average = monthRows.length ? monthRows.reduce((sum, row) => sum + row.headcount, 0) / monthRows.length : closingList.length;
  const joiners = monthRows.reduce((sum, row) => sum + row.joiners, 0);
  const leavers = monthRows.reduce((sum, row) => sum + row.leavers, 0);

  const count = (values: (string | undefined)[], fallback: string) => {
    const map = new Map<string, number>();
    for (const value of values) map.set(value?.trim() || fallback, (map.get(value?.trim() || fallback) ?? 0) + 1);
    return toSlices(map);
  };
  const exited = docs.filter((doc) => doc.exitDate && doc.exitDate >= start && doc.exitDate <= end);

  /* Távollétek. */
  const workdays = eachDay(start, end).filter(isWorkday).length;
  const byType = new Map<AbsenceType, number>();
  const byMonth = months.map((month) => {
    const values: Partial<Record<AbsenceType, number>> = {};
    const first = `${month}-01`;
    const last = month === period.toMonth ? end : lastDay(month);
    for (const row of absenceRows) {
      const days = daysWithin(row, first, last);
      if (days) values[row.type] = (values[row.type] ?? 0) + days;
    }
    return { month, values };
  });
  for (const { values } of byMonth) for (const [type, value] of Object.entries(values) as [AbsenceType, number][]) byType.set(type, (byType.get(type) ?? 0) + value);
  const totalDays = [...byType.values()].reduce((sum, value) => sum + value, 0);

  /* Képzések. */
  const participants = trainingDocs.flatMap((doc) => doc.participants ?? []);
  const passed = participants.filter((item) => item.exam === "megfelelt").length;
  const failed = participants.filter((item) => item.exam === "nem_felelt_meg").length;
  const trainingTypes = new Map<TrainingType, number>();
  for (const doc of trainingDocs) trainingTypes.set(doc.type, (trainingTypes.get(doc.type) ?? 0) + 1);

  return {
    period,
    generatedAt: new Date().toISOString(),
    headcount: {
      opening,
      closing: closingList.length,
      average: round1(average),
      joiners,
      leavers,
      fluctuation: average > 0 ? round1((leavers / average) * 100) : 0,
      months: monthRows,
      byPosition: count(closingList.map((doc) => doc.position), "Nincs megadva"),
      byDepartment: count(closingList.map((doc) => doc.department), "Nincs megadva"),
      exitsByReason: count(
        exited.map((doc) => (doc.exitReason ? EXIT_REASONS[doc.exitReason as ExitReason] ?? doc.exitReason : undefined)),
        "Nincs megadva",
      ),
    },
    absence: {
      totalDays: round1(totalDays),
      rate: average > 0 && workdays > 0 ? round1((totalDays / (average * workdays)) * 100) : 0,
      workdays,
      byType: (Object.keys(ABSENCE_TYPES) as AbsenceType[])
        .filter((type) => byType.get(type))
        .map((type) => ({ type, label: ABSENCE_TYPES[type], value: round1(byType.get(type)!) })),
      byMonth,
    },
    training: {
      held: trainingDocs.length,
      participants: participants.length,
      uniqueParticipants: new Set(participants.map((item) => item.employeeId)).size,
      passed,
      failed,
      passRate: passed + failed ? round1((passed / (passed + failed)) * 100) : null,
      cost: trainingDocs.reduce((sum, doc) => sum + (doc.cost ?? 0), 0),
      studyContracts: participants.filter((item) => item.studyContract).length,
      byType: (Object.keys(TRAINING_TYPES) as TrainingType[])
        .filter((type) => trainingTypes.get(type))
        .map((type) => ({ type, label: TRAINING_TYPES[type], value: trainingTypes.get(type)! })),
      expiring: expiries.filter((item) => item.daysLeft >= 0).length,
      expired: expiries.filter((item) => item.daysLeft < 0).length,
    },
    quality: {
      missingStart: docs.filter((doc) => !doc.startDate && doc.status !== "kilepett").length,
      exitedWithoutDate: docs.filter((doc) => doc.status === "kilepett" && !doc.exitDate).length,
    },
  };
}

export const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: digits }).format(value);

/** Az AI-nak átadott összefoglaló: kizárólag összesített számok és kategóriák, név és személyes adat nélkül. */
export function reportFacts(data: ReportData) {
  const { headcount: h, absence: a, training: t } = data;
  const top = (slices: Slice[], max = 8) => slices.slice(0, max).map((slice) => `${slice.label}: ${slice.value}`).join("; ") || "nincs adat";
  return [
    `Időszak: ${data.period.label} (${data.period.months.length} hónap).`,
    `Létszám: nyitó ${h.opening}, záró ${h.closing}, átlagos ${formatNumber(h.average)} fő.`,
    `Belépők: ${h.joiners}, kilépők: ${h.leavers}. Fluktuáció: ${formatNumber(h.fluctuation)}% (kilépők ÷ átlagos létszám × 100).`,
    `Havi létszám (hónap: létszám/belépő/kilépő): ${h.months.map((row) => `${row.month}: ${row.headcount}/${row.joiners}/${row.leavers}`).join("; ")}.`,
    `Kilépések oka: ${top(h.exitsByReason)}.`,
    `Záró létszám munkakör szerint: ${top(h.byPosition)}.`,
    `Záró létszám szervezeti egység szerint: ${top(h.byDepartment)}.`,
    `Távolléti munkanapok összesen: ${formatNumber(a.totalDays)}; távolléti ráta: ${formatNumber(a.rate)}% (${a.workdays} munkanap alapján). Típus szerint: ${top(a.byType, 10)}.`,
    `Képzések: ${t.held} képzés, ${t.participants} részvétel (${t.uniqueParticipants} különböző dolgozó), megfelelt ${t.passed}, nem felelt meg ${t.failed}, sikerességi arány: ${t.passRate === null ? "nincs vizsgaadat" : `${formatNumber(t.passRate)}%`}. Költség: ${formatNumber(t.cost, 0)} Ft. Tanulmányi szerződés: ${t.studyContracts}. Típus szerint: ${top(t.byType)}.`,
    `Tanúsítványok most: ${t.expired} lejárt, ${t.expiring} jár le 90 napon belül.`,
    data.quality.missingStart || data.quality.exitedWithoutDate
      ? `Adatminőség: ${data.quality.missingStart} aktív dolgozónál hiányzik a belépés dátuma, ${data.quality.exitedWithoutDate} kilépettnél a kilépés dátuma.`
      : "Adatminőség: a dátumok hiánytalanok.",
  ].join("\n");
}


/* ---------- Táblázatok (a diagramok táblanézete és a CSV-export) ---------- */

type Table = { columns: string[]; rows: (string | number)[][] };

export function reportTables(data: ReportData): Record<"headcount" | "flow" | "position" | "department" | "exits" | "absenceType" | "absenceMonth" | "trainingType", Table> {
  const { headcount: h, absence: a, training: t } = data;
  const slices = (first: string, list: Slice[], unit = "Fő") => ({ columns: [first, unit], rows: list.map((item) => [item.label, item.value]) });
  const absenceTypes = (Object.keys(ABSENCE_TYPES) as AbsenceType[]).filter((type) => a.byType.some((item) => item.type === type));
  return {
    headcount: { columns: ["Hónap", "Létszám (hó végén)", "Belépő", "Kilépő"], rows: h.months.map((row) => [formatMonth(row.month), row.headcount, row.joiners, row.leavers]) },
    flow: { columns: ["Hónap", "Belépő", "Kilépő", "Nettó változás"], rows: h.months.map((row) => [formatMonth(row.month), row.joiners, row.leavers, row.joiners - row.leavers]) },
    position: slices("Munkakör", h.byPosition),
    department: slices("Szervezeti egység", h.byDepartment),
    exits: slices("Kilépés oka", h.exitsByReason),
    absenceType: { columns: ["Távollét típusa", "Munkanap"], rows: a.byType.map((item) => [item.label, item.value]) },
    absenceMonth: {
      columns: ["Hónap", ...absenceTypes.map((type) => ABSENCE_TYPES[type]), "Összesen"],
      rows: a.byMonth.map((row) => [
        formatMonth(row.month),
        ...absenceTypes.map((type) => row.values[type] ?? 0),
        Object.values(row.values).reduce((sum, value) => sum + (value ?? 0), 0),
      ]),
    },
    trainingType: slices("Képzés típusa", t.byType, "Képzés"),
  };
}

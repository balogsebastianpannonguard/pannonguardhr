import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { addDays, dayKey } from "@/lib/dates";
import { getDb } from "@/lib/mongodb";

/* ---------- Szótárak ---------- */

export const PROCESS_KINDS = { belepes: "Belépés", kilepes: "Kilépés" } as const;
export type ProcessKind = keyof typeof PROCESS_KINDS;
export const isProcessKind = (value: string): value is ProcessKind => value in PROCESS_KINDS;

export const PROCESS_STATUS = { nyitott: "Folyamatban", lezart: "Lezárva", megszakitva: "Megszakítva" } as const;
export type ProcessStatus = keyof typeof PROCESS_STATUS;
export const isProcessStatus = (value: string): value is ProcessStatus => value in PROCESS_STATUS;

/** A viszonyítási nap megnevezése típusonként (a lépések határideje ehhez képest számolódik). */
export const REFERENCE_LABEL: Record<ProcessKind, string> = {
  belepes: "Munkába lépés napja",
  kilepes: "Munkaviszony megszűnésének napja",
};

/* ---------- Ellenőrzőlista-sablonok ---------- */

export type StepTemplate = {
  title: string;
  hint?: string;
  /** Határidő a viszonyítási naphoz képest (negatív: előtte). */
  offsetDays: number;
  optional?: boolean;
};

export const DEFAULT_STEPS: Record<ProcessKind, StepTemplate[]> = {
  belepes: [
    { title: "Munkaszerződés aláírása", hint: "Két eredeti példány, egy a munkavállalónak. Határozott időnél a lejárat, próbaidőnél annak vége is szerepeljen.", offsetDays: -2 },
    { title: "Munkáltatói tájékoztató (Mt. 46. §) átadása", hint: "Legkésőbb a munkába lépéstől számított 7 napon belül, írásban; az átvételt aláírással igazoltasd.", offsetDays: 7 },
    { title: "Adatkezelési tájékoztató átadása", hint: "GDPR 13. cikk szerinti munkavállalói adatkezelési tájékoztató, átvételi elismervénnyel.", offsetDays: 0 },
    { title: "NAV-bejelentés (T1041) a munkába lépés előtt", hint: "A biztosítási jogviszony bejelentése legkésőbb a munkába lépés napján, a munkavégzés megkezdése előtt.", offsetDays: -1 },
    { title: "Foglalkozás-egészségügyi alkalmassági vizsgálat", hint: "Előzetes munkaköri alkalmassági vizsgálat; a munkába lépés előtt meg kell lennie.", offsetDays: -3 },
    { title: "Vagyonőri igazolvány ellenőrzése", hint: "Érvényesség és kategória ellenőrzése (2005. évi CXXXIII. tv.), másolat a személyi anyagba, lejárat rögzítése.", offsetDays: -3 },
    { title: "Munkavédelmi és tűzvédelmi oktatás", hint: "Az első munkanapon, az oktatási naplóban aláíratva.", offsetDays: 0 },
    { title: "Egyenruha és eszközök kiadása", hint: "Egyenruha, rádió, zseblámpa stb. – átadás-átvételi elismervénnyel.", offsetDays: 0 },
    { title: "Belépőkártya és hozzáférések", hint: "Objektum-belépő, rendszer-hozzáférések, kulcsok – a nyilvántartásba vétellel.", offsetDays: 0 },
    { title: "Bankszámla és adóadatok bekérése", hint: "Bankszámlaszám, adóelőleg-nyilatkozatok (családi kedvezmény, első házas stb.) a bérszámfejtésnek.", offsetDays: -1 },
    { title: "Első munkanap / mentor kijelölése", hint: "Fogadás, objektumbejárás, a mentor vagy objektumvezető bemutatása.", offsetDays: 0 },
  ],
  kilepes: [
    { title: "Megszüntető irat (felmondás / közös megegyezés)", hint: "Írásban, a közlés igazolható módon (átvételi aláírás vagy tértivevény). Felmondásnál az indoklás és a felmondási idő.", offsetDays: -14 },
    { title: "Munkáltatói igazolás és kilépő papírok átadása", hint: "Mt. 80. §: legkésőbb a megszűnést követő 5. munkanapon – munkáltatói igazolás, adó- és járulékigazolás, igazolás az álláskeresési ellátáshoz.", offsetDays: 5 },
    { title: "NAV-kijelentés (T1041)", hint: "A biztosítási jogviszony megszűnésének bejelentése a megszűnést követő 8 napon belül.", offsetDays: 8 },
    { title: "Eszközök és egyenruha visszavétele", hint: "Az átadás-átvételi elismervény alapján; hiány esetén jegyzőkönyv.", offsetDays: 0 },
    { title: "Szabadság- és bérelszámolás", hint: "Arányos szabadság, ki nem adott szabadság megváltása, levonások – a bérszámfejtéssel egyeztetve.", offsetDays: 5 },
    { title: "Hozzáférések megszüntetése", hint: "Belépőkártya, kulcsok, rendszer- és e-mail-hozzáférés az utolsó munkanapon.", offsetDays: 0 },
    { title: "Kilépő interjú", hint: "A távozás okainak megismerése, visszajelzés a csapatról.", offsetDays: -3, optional: true },
    { title: "Tanulmányi szerződés ellenőrzése", hint: "Van-e visszafizetési kötelezettség (pl. vagyonőri képzés), a munkáltatói kölcsön vagy előleg rendezése.", offsetDays: -7 },
  ],
};

/** A `hr_templates` gyűjteményben a dokumentumsablonokkal közösen, `checklist:<típus>` azonosítóval. */
export type ChecklistDocument = { _id: string; kind: "checklist"; steps: StepTemplate[]; updatedAt: Date; updatedBy: string };
export const checklistId = (kind: ProcessKind) => `checklist:${kind}`;

export const checklists = async () => (await getDb()).collection<ChecklistDocument>("hr_templates");

/** A szerkesztett (adatbázisban tárolt) lista, ha van; különben a beépített alapértelmezés. */
export async function getChecklist(kind: ProcessKind) {
  const doc = await (await checklists()).findOne({ _id: checklistId(kind) });
  return { steps: doc?.steps?.length ? doc.steps : DEFAULT_STEPS[kind], custom: Boolean(doc?.steps?.length), updatedAt: doc?.updatedAt, updatedBy: doc?.updatedBy };
}

/* ---------- Folyamatok ---------- */

export type ProcessStep = {
  id: string;
  title: string;
  hint?: string;
  optional?: boolean;
  dueDate?: string;
  done: boolean;
  doneAt?: Date;
  doneBy?: string;
  comment?: string;
  commentAt?: Date;
  commentBy?: string;
};

export type ProcessDocument = {
  _id: ObjectId;
  kind: ProcessKind;
  employeeId: ObjectId;
  /** Pillanatkép a listázáshoz (a név és a munkakör nem bizalmas adat a törzsben sem). */
  employeeName: string;
  position?: string;
  /** Viszonyítási nap: belépésnél a munkába lépés, kilépésnél a megszűnés napja. */
  referenceDate: string;
  /** A folyamat indítása (ÉÉÉÉ-HH-NN). */
  startDate: string;
  dueDate?: string;
  responsible?: string;
  status: ProcessStatus;
  note?: string;
  steps: ProcessStep[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  closedAt?: Date;
};

export type Process = Omit<ProcessDocument, "_id" | "employeeId"> & { id: string; employeeId: string };

export const processes = async () => (await getDb()).collection<ProcessDocument>("hr_processes");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const collection = await processes();
  await Promise.all([collection.createIndex({ status: 1, dueDate: 1 }), collection.createIndex({ employeeId: 1, createdAt: -1 })]);
  indexed = true;
}

export const toProcess = ({ _id, employeeId, ...rest }: ProcessDocument): Process => ({ ...rest, id: String(_id), employeeId: String(employeeId), steps: rest.steps ?? [] });

export function stepsFromTemplate(template: StepTemplate[], referenceDate: string): ProcessStep[] {
  return template.map((step) => ({
    id: new ObjectId().toHexString(),
    title: step.title,
    hint: step.hint,
    optional: step.optional || undefined,
    dueDate: addDays(referenceDate, step.offsetDays),
    done: false,
  }));
}

export async function listProcesses({ status, employeeId }: { status?: ProcessStatus | "all"; employeeId?: ObjectId } = {}) {
  await ensureIndexes();
  const filter: Filter<ProcessDocument> = {};
  if (status && status !== "all") filter.status = status;
  if (employeeId) filter.employeeId = employeeId;
  const docs = await (await processes()).find(filter).sort({ status: 1, dueDate: 1, createdAt: -1 }).limit(500).toArray();
  return docs.map(toProcess);
}

export async function getProcess(id: ObjectId) {
  const doc = await (await processes()).findOne({ _id: id });
  return doc ? toProcess(doc) : null;
}

/* ---------- Számítások ---------- */

export function progressOf(process: Pick<Process, "steps">) {
  const required = process.steps.filter((step) => !step.optional);
  const done = required.filter((step) => step.done).length;
  return { done, total: required.length, percent: required.length ? Math.round((done / required.length) * 100) : 100, allDone: done === required.length };
}

export const isStepOverdue = (step: Pick<ProcessStep, "done" | "dueDate">, today = dayKey(new Date())) => Boolean(!step.done && step.dueDate && step.dueDate < today);

export function overdueSteps(process: Pick<Process, "steps" | "status">, today = dayKey(new Date())) {
  return process.status === "nyitott" ? process.steps.filter((step) => isStepOverdue(step, today)) : [];
}

export const isProcessOverdue = (process: Pick<Process, "status" | "dueDate">, today = dayKey(new Date())) =>
  Boolean(process.status === "nyitott" && process.dueDate && process.dueDate < today);

const fullDate = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
/** ÉÉÉÉ-HH-NN → „2026. nov. 12.” */
export const formatDate = (key?: string) => (key ? fullDate.format(new Date(`${key}T12:00:00Z`)) : "–");

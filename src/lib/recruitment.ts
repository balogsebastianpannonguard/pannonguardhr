import "server-only";
import { ObjectId } from "mongodb";
import type { EmploymentType, QualificationKind } from "@/lib/employees";
import { getDb } from "@/lib/mongodb";
import type { AdTone, CandidateSource, PositionStatus, Stage } from "@/lib/recruitment-meta";

/* ---------- Adatmodell ---------- */

export type PositionDoc = {
  _id: ObjectId;
  title: string;
  /** Szervezeti egység / objektum. */
  department?: string;
  location?: string;
  employmentType: EmploymentType;
  /** Munkarend, pl. „12 órás műszak, 4 nap be / 4 nap ki”. */
  schedule?: string;
  /** Bérsáv szövegesen, pl. „bruttó 420–480 ezer Ft”. */
  salary?: string;
  headcount: number;
  status: PositionStatus;
  requirements?: string;
  niceToHave?: string;
  benefits?: string;
  ad?: { text: string; tone: AdTone; at: Date };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type Experience = { period: string; role: string; employer: string; description: string };
export type CandidateQualification = { kind: QualificationKind; name: string; number?: string; expiresAt?: string };
export type Interview = { id: string; date: string; time: string; place: string; interviewer: string; note?: string };
export type Score = { name: string; score?: number; note?: string };
export type Fit = { score: number; summary: string; strengths: string[]; gaps: string[]; questions: string[]; at: Date };
export type HistoryEntry = { at: Date; by: string; action: string };

export type CandidateDoc = {
  _id: ObjectId;
  positionId: ObjectId;
  stage: Stage;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  experience: Experience[];
  education: string[];
  qualifications: CandidateQualification[];
  drivingLicence?: string;
  languages: string[];
  skills: string[];
  availability?: string;
  source: CandidateSource;
  /** Az önéletrajzból kinyert szöveg (az eredeti fájlt nem tároljuk). */
  cvText?: string;
  rating?: number;
  notes?: string;
  interviews: Interview[];
  scorecard?: { criteria: Score[]; notes?: string; at: Date };
  fit?: Fit;
  questions?: { list: string[]; at: Date };
  rejectionDraft?: string;
  employeeId?: ObjectId;
  stageChangedAt: Date;
  rejectedAt?: Date;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type Position = Omit<PositionDoc, "_id"> & { id: string };
export type Candidate = Omit<CandidateDoc, "_id" | "positionId" | "employeeId"> & { id: string; positionId: string; employeeId?: string };

export const positions = async () => (await getDb()).collection<PositionDoc>("positions");
export const candidates = async () => (await getDb()).collection<CandidateDoc>("candidates");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const [p, c] = await Promise.all([positions(), candidates()]);
  await Promise.all([
    p.createIndex({ status: 1, updatedAt: -1 }),
    c.createIndex({ positionId: 1, stage: 1 }),
    c.createIndex({ stage: 1, rejectedAt: 1 }),
  ]);
  indexed = true;
}

export const parseId = (id: string) => (typeof id === "string" && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

export function toPosition({ _id, ...rest }: PositionDoc): Position {
  return { ...rest, id: String(_id) };
}

export function toCandidate({ _id, positionId, employeeId, ...rest }: CandidateDoc): Candidate {
  return {
    ...rest,
    id: String(_id),
    positionId: String(positionId),
    employeeId: employeeId ? String(employeeId) : undefined,
    experience: rest.experience ?? [],
    education: rest.education ?? [],
    qualifications: rest.qualifications ?? [],
    languages: rest.languages ?? [],
    skills: rest.skills ?? [],
    interviews: rest.interviews ?? [],
    history: rest.history ?? [],
  };
}

export type PositionRow = Position & { counts: Partial<Record<Stage, number>>; total: number };

/** Az álláshelyek jelöltszámokkal, szakaszonként. Elöl a nyitottak, aztán a szünetelők, végül a lezártak. */
export async function listPositions(): Promise<PositionRow[]> {
  await ensureIndexes();
  const [docs, counts] = await Promise.all([
    (await positions()).find().sort({ updatedAt: -1 }).limit(500).toArray(),
    (await candidates())
      .aggregate<{ _id: { positionId: ObjectId; stage: Stage }; n: number }>([{ $group: { _id: { positionId: "$positionId", stage: "$stage" }, n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const byPosition = new Map<string, Partial<Record<Stage, number>>>();
  for (const { _id, n } of counts) {
    const key = String(_id.positionId);
    byPosition.set(key, { ...byPosition.get(key), [_id.stage]: n });
  }
  const order: Record<PositionStatus, number> = { nyitott: 0, szunetel: 1, lezart: 2 };
  return docs
    .map((doc) => {
      const row = toPosition(doc);
      const stageCounts = byPosition.get(row.id) ?? {};
      return { ...row, counts: stageCounts, total: Object.values(stageCounts).reduce((sum, n) => sum + (n ?? 0), 0) };
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}

export async function getPosition(id: string) {
  const _id = parseId(id);
  if (!_id) return null;
  const doc = await (await positions()).findOne({ _id });
  return doc ? toPosition(doc) : null;
}

/** Egy álláshely jelöltjei (a nyers önéletrajz-szöveg nélkül), a legújabb elöl. */
export async function listCandidates(positionId: string) {
  await ensureIndexes();
  const _id = parseId(positionId);
  if (!_id) return [];
  const docs = await (await candidates()).find({ positionId: _id }, { projection: { cvText: 0 } }).sort({ createdAt: -1 }).limit(1000).toArray();
  return docs.map(toCandidate);
}

export async function getCandidate(id: string) {
  const _id = parseId(id);
  if (!_id) return null;
  const doc = await (await candidates()).findOne({ _id });
  return doc ? toCandidate(doc) : null;
}

/** Elutasított jelöltek, akik legalább `days` napja vannak elutasítva (GDPR-törléshez). */
export async function countStaleRejected(days: number) {
  const before = new Date(Date.now() - days * 86_400_000);
  return (await candidates()).countDocuments({ stage: "elutasitva", $or: [{ rejectedAt: { $lt: before } }, { rejectedAt: { $exists: false }, updatedAt: { $lt: before } }] });
}

/* ---------- Szöveges segédek a promptokhoz és az összevetéshez ---------- */

export function positionBrief(position: Position) {
  return [
    `Munkakör: ${position.title}`,
    position.department && `Egység / objektum: ${position.department}`,
    position.location && `Helyszín: ${position.location}`,
    position.schedule && `Munkarend: ${position.schedule}`,
    position.salary && `Bérezés: ${position.salary}`,
    `Létszám: ${position.headcount} fő`,
    position.requirements && `Elvárások:\n${position.requirements}`,
    position.niceToHave && `Előny:\n${position.niceToHave}`,
    position.benefits && `Amit kínálunk:\n${position.benefits}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A jelölt profilja promptba: elérhetőség (e-mail, telefon) nélkül, mert az értékeléshez nem kell. */
export function candidateBrief(candidate: Candidate) {
  return [
    `Jelölt: ${candidate.name}`,
    candidate.location && `Lakóhely (település): ${candidate.location}`,
    candidate.summary && `Összefoglaló: ${candidate.summary}`,
    candidate.experience.length &&
      `Tapasztalat:\n${candidate.experience.map((item) => `- ${[item.period, item.role, item.employer].filter(Boolean).join(" · ")}${item.description ? `: ${item.description}` : ""}`).join("\n")}`,
    candidate.education.length && `Végzettség: ${candidate.education.join("; ")}`,
    candidate.qualifications.length &&
      `Képesítések: ${candidate.qualifications.map((item) => `${item.name}${item.expiresAt ? ` (érvényes: ${item.expiresAt})` : ""}`).join("; ")}`,
    candidate.drivingLicence && `Jogosítvány: ${candidate.drivingLicence}`,
    candidate.languages.length && `Nyelvek: ${candidate.languages.join(", ")}`,
    candidate.skills.length && `Készségek: ${candidate.skills.join(", ")}`,
    candidate.availability && `Elérhetőség / kezdés: ${candidate.availability}`,
    candidate.scorecard?.criteria.some((item) => item.score) &&
      `Interjú-értékelés: ${candidate.scorecard.criteria.filter((item) => item.score).map((item) => `${item.name}: ${item.score}/5`).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Van-e a jelöltnek vagyonőri igazolványa (a név alapján). */
export const guardLicenceOf = (candidate: Pick<Candidate, "qualifications">) =>
  candidate.qualifications.find((item) => /vagyon[őo]r/i.test(item.name) && item.kind !== "vegzettseg") ??
  candidate.qualifications.find((item) => /vagyon[őo]r/i.test(item.name));

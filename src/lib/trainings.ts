import "server-only";
import { ObjectId } from "mongodb";
import { addDays, dayKey } from "@/lib/dates";
import { employeeOptions, employees, EXIT_REASONS, type ExitReason } from "@/lib/employees";
import { getDb } from "@/lib/mongodb";
import { participantExpiry, type Participant, type TrainingRow, type TrainingType } from "@/lib/trainings-meta";

export type TrainingDoc = {
  _id: ObjectId;
  name: string;
  type: TrainingType;
  /** ÉÉÉÉ-HH-NN */
  startDate: string;
  endDate?: string;
  trainer?: string;
  location?: string;
  /** A tanúsítvány érvényessége hónapban (üres: nem jár le). */
  validityMonths?: number;
  /** Bruttó költség forintban. */
  cost?: number;
  notes?: string;
  participants: Participant[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export const trainings = async () => (await getDb()).collection<TrainingDoc>("trainings");

let indexed = false;
async function ensureIndexes() {
  if (indexed) return;
  const collection = await trainings();
  await Promise.all([collection.createIndex({ startDate: -1 }), collection.createIndex({ "participants.employeeId": 1 })]);
  indexed = true;
}

export const parseTrainingId = (id: string) => (/^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null);

/** Az aktuális dolgozói nevek (a résztvevőknél tárolt név csak tartalék). */
async function nameMap() {
  const options = await employeeOptions(true);
  return new Map(options.map((option) => [option.id, option]));
}

function toRow(doc: TrainingDoc, names?: Map<string, { name: string; position: string }>): TrainingRow {
  return {
    id: String(doc._id),
    name: doc.name,
    type: doc.type,
    startDate: doc.startDate,
    endDate: doc.endDate,
    trainer: doc.trainer,
    location: doc.location,
    validityMonths: doc.validityMonths,
    cost: doc.cost,
    notes: doc.notes,
    updatedAt: doc.updatedAt.toISOString(),
    participants: (doc.participants ?? [])
      .map((participant) => {
        const current = names?.get(participant.employeeId);
        return {
          ...participant,
          name: current?.name ?? participant.name,
          position: current?.position ?? participant.position,
          expiresAt: participantExpiry(doc, participant),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "hu")),
  };
}

export type TrainingQuery = { q?: string; type?: string; year?: string };

export async function listTrainings({ q, type, year }: TrainingQuery = {}) {
  await ensureIndexes();
  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;
  if (year && /^\d{4}$/.test(year)) filter.startDate = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
  if (q?.trim()) {
    const pattern = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: pattern }, { trainer: pattern }, { location: pattern }, { "participants.name": pattern }];
  }
  const [docs, names] = await Promise.all([(await trainings()).find(filter).sort({ startDate: -1 }).limit(500).toArray(), nameMap()]);
  return docs.map((doc) => toRow(doc, names));
}

export async function getTraining(id: string) {
  const _id = parseTrainingId(id);
  if (!_id) return null;
  const [doc, names] = await Promise.all([(await trainings()).findOne({ _id }), nameMap()]);
  return doc ? toRow(doc, names) : null;
}

/** Egy dolgozó összes képzése (a legfrissebb elöl), a saját résztvevői adataival. */
export async function trainingsOfEmployee(employeeId: string) {
  await ensureIndexes();
  const docs = await (await trainings()).find({ "participants.employeeId": employeeId }).sort({ startDate: -1 }).toArray();
  return docs.map((doc) => {
    const row = toRow(doc);
    const participant = row.participants.find((item) => item.employeeId === employeeId)!;
    return { training: { ...row, participants: [] }, participant };
  });
}

/* ---------- Lejáró tanúsítványok ---------- */

/** A dolgozói lejárat-figyelés (`Expiry`) alakja, „kepzes” fajtával. */
export type TrainingExpiry = {
  employeeId: string;
  employeeName: string;
  kind: "kepzes";
  label: string;
  date: string;
  daysLeft: number;
  trainingId: string;
  trainingType: TrainingType;
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Melyik tanúsítványok „helyettesítik” egymást: a kötelező típusoknál a típus, a többinél a képzés neve. */
const supersedeKey = (employeeId: string, type: TrainingType, name: string) =>
  type === "szakmai" || type === "egyeb" ? `${employeeId}:${type}:${name.trim().toLowerCase()}` : `${employeeId}:${type}`;

/**
 * Az aktív (nem kilépett) dolgozók `withinDays` napon belül lejáró vagy már lejárt képzési tanúsítványai, sürgősség
 * szerint. Ha ugyanabból később újabb, érvényes tanúsítvány készült, csak a legutóbbi számít.
 */
export async function trainingExpiries(withinDays: number): Promise<TrainingExpiry[]> {
  await ensureIndexes();
  const today = dayKey(new Date());
  const limit = addDays(today, withinDays);
  const [docs, options] = await Promise.all([
    (await trainings()).find({ validityMonths: { $gt: 0 } }, { projection: { name: 1, type: 1, startDate: 1, endDate: 1, validityMonths: 1, participants: 1 } }).toArray(),
    employeeOptions(false),
  ]);
  const active = new Map(options.map((option) => [option.id, option.name]));
  const latest = new Map<string, TrainingExpiry>();
  for (const doc of docs) {
    for (const participant of doc.participants ?? []) {
      const name = active.get(participant.employeeId);
      const date = participantExpiry(doc, participant);
      if (!name || !date) continue;
      const item: TrainingExpiry = {
        employeeId: participant.employeeId,
        employeeName: name,
        kind: "kepzes",
        label: doc.name,
        date,
        daysLeft: daysBetween(today, date),
        trainingId: String(doc._id),
        trainingType: doc.type,
      };
      const id = supersedeKey(participant.employeeId, doc.type, doc.name);
      const previous = latest.get(id);
      if (!previous || previous.date < date) latest.set(id, item);
    }
  }
  return [...latest.values()].filter((item) => item.date <= limit).sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ---------- Kilépők ---------- */

export type LeaverTraining = {
  trainingId: string;
  name: string;
  type: TrainingType;
  date: string;
  studyContract: boolean;
  studyAmount?: number;
  repayment?: Participant["repayment"];
};

export type Leaver = {
  employeeId: string;
  name: string;
  position: string;
  exitDate?: string;
  exitReason?: string;
  trainings: LeaverTraining[];
};

/** Az elmúlt `months` hónapban kilépett dolgozók és a képzéseik (tanulmányi szerződés követéséhez). */
export async function recentLeavers(months = 12): Promise<Leaver[]> {
  await ensureIndexes();
  const since = addDays(dayKey(new Date()), -Math.round(months * 30.44));
  const docs = await (await employees())
    .find({ status: "kilepett", exitDate: { $gte: since } }, { projection: { name: 1, position: 1, exitDate: 1, exitReason: 1 } })
    .sort({ exitDate: -1 })
    .toArray();
  if (!docs.length) return [];
  const ids = docs.map((doc) => String(doc._id));
  const items = await (await trainings()).find({ "participants.employeeId": { $in: ids } }).sort({ startDate: -1 }).toArray();
  return docs.map((doc) => {
    const id = String(doc._id);
    return {
      employeeId: id,
      name: doc.name,
      position: doc.position,
      exitDate: doc.exitDate,
      exitReason: doc.exitReason ? EXIT_REASONS[doc.exitReason as ExitReason] ?? doc.exitReason : undefined,
      trainings: items.flatMap((training) => {
        const participant = training.participants.find((item) => item.employeeId === id);
        return participant
          ? [
              {
                trainingId: String(training._id),
                name: training.name,
                type: training.type,
                date: training.endDate || training.startDate,
                studyContract: participant.studyContract,
                studyAmount: participant.studyAmount,
                repayment: participant.repayment,
              },
            ]
          : [];
      }),
    };
  });
}

/* ---------- Statisztika a kimutatásokhoz ---------- */

/** Egy időszak képzései (a kezdőnap alapján), nyers formában az összesítéshez. */
export async function trainingsBetween(from: string, to: string) {
  await ensureIndexes();
  return (await trainings())
    .find({ startDate: { $gte: from, $lte: to } }, { projection: { name: 1, type: 1, startDate: 1, endDate: 1, cost: 1, validityMonths: 1, participants: 1 } })
    .toArray();
}

/** Képzések: szótárak és tiszta segédfüggvények (kliensen és szerveren is használható). */

export const TRAINING_TYPES = {
  munkavedelmi: "Munkavédelmi oktatás",
  tuzvedelmi: "Tűzvédelmi oktatás",
  vagyonori: "Vagyonőri továbbképzés",
  szakmai: "Szakmai képzés",
  elsosegely: "Elsősegély-képzés",
  egyeb: "Egyéb",
} as const;
export type TrainingType = keyof typeof TRAINING_TYPES;
export const isTrainingType = (value: string): value is TrainingType => value in TRAINING_TYPES;

export const ATTENDANCE = {
  "": "Nincs rögzítve",
  jelen: "Jelen volt",
  reszben: "Részben",
  hianyzott: "Hiányzott",
} as const;
export type Attendance = keyof typeof ATTENDANCE;
export const isAttendance = (value: string): value is Attendance => value in ATTENDANCE;

export const EXAM_RESULTS = {
  "": "Nincs vizsga / még nincs eredmény",
  megfelelt: "Megfelelt",
  nem_felelt_meg: "Nem felelt meg",
} as const;
export type ExamResult = keyof typeof EXAM_RESULTS;
export const isExamResult = (value: string): value is ExamResult => value in EXAM_RESULTS;

/** Tanulmányi szerződés visszafizetésének követése kilépéskor. */
export const REPAYMENT_STATUS = {
  "": "Nincs teendő rögzítve",
  ellenorizendo: "Ellenőrizendő",
  folyamatban: "Visszafizetés folyamatban",
  rendezve: "Rendezve",
  nem_esedekes: "Nem esedékes / elengedve",
} as const;
export type RepaymentStatus = keyof typeof REPAYMENT_STATUS;
export const isRepaymentStatus = (value: string): value is RepaymentStatus => value in REPAYMENT_STATUS;

export type Participant = {
  employeeId: string;
  /** A név pillanatképe a felvételkor (a felületen a dolgozói adatbázis aktuális neve az elsődleges). */
  name: string;
  position?: string;
  attendance: Attendance;
  exam: ExamResult;
  score?: number;
  certificateNumber?: string;
  studyContract: boolean;
  studyAmount?: number;
  repayment?: RepaymentStatus;
};

/** A felületnek átadható képzés (string azonosító, számolt lejárattal). */
export type TrainingRow = {
  id: string;
  name: string;
  type: TrainingType;
  startDate: string;
  endDate?: string;
  trainer?: string;
  location?: string;
  validityMonths?: number;
  cost?: number;
  notes?: string;
  participants: (Participant & { expiresAt?: string })[];
  updatedAt: string;
};

/** Hónapok hozzáadása egy naphoz (ÉÉÉÉ-HH-NN); hónap végén a cél hónap utolsó napjára igazít. */
export function addMonthsToDay(day: string, months: number) {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** A képzés zárónapja: a befejezés, ennek hiányában a kezdés napja. */
export const trainingDay = (training: { startDate: string; endDate?: string }) => training.endDate || training.startDate;

/** Érvényes-e a résztvevő tanúsítványa (nem hiányzott és nem bukott meg). */
export const certified = (participant: Pick<Participant, "attendance" | "exam">) =>
  participant.attendance !== "hianyzott" && participant.exam !== "nem_felelt_meg";

/** A tanúsítvány lejárata: zárónap + érvényesség hónapban; csak érvényes eredménynél. */
export function participantExpiry(training: { startDate: string; endDate?: string; validityMonths?: number }, participant: Pick<Participant, "attendance" | "exam">) {
  if (!training.validityMonths || !certified(participant)) return undefined;
  return addMonthsToDay(trainingDay(training), training.validityMonths);
}

export const formatHuf = (value?: number) =>
  value === undefined ? "–" : new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(value);

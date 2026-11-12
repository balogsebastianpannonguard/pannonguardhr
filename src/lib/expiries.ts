import "server-only";
import { upcomingExpiries, type Expiry } from "@/lib/employees";
import { trainingExpiries } from "@/lib/trainings";

/** Minden figyelt lejárat egy listában: a dolgozói adatlap dátumai és a képzési tanúsítványok, sürgősség szerint. */
export async function allExpiries(withinDays = 90): Promise<Expiry[]> {
  const [own, trainings] = await Promise.all([upcomingExpiries(withinDays), trainingExpiries(withinDays).catch(() => [])]);
  const fromTrainings: Expiry[] = trainings.map(({ employeeId, employeeName, label, date, daysLeft }) => ({
    employeeId,
    employeeName,
    kind: "kepzes",
    label,
    date,
    daysLeft,
  }));
  return [...own, ...fromTrainings].sort((a, b) => a.daysLeft - b.daysLeft);
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BadgeCheck, GraduationCap, TimerReset } from "lucide-react";
import { Empty, Panel, Pill, Skeleton, Stat } from "@/components/ui";
import { dayKey, formatShortDate } from "@/lib/dates";
import { EMPLOYEE_STATUS, expiryText, getEmployee } from "@/lib/employees";
import { requireUser } from "@/lib/session";
import { trainingsOfEmployee } from "@/lib/trainings";
import { ATTENDANCE, EXAM_RESULTS, REPAYMENT_STATUS, TRAINING_TYPES, formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Képzési előzmények" };

export default function EmployeeTrainingsPage({ params }: PageProps<"/kepzesek/dolgozo/[employeeId]">) {
  return (
    <div className="space-y-6">
      <Link href="/kepzesek" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Képzések
      </Link>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <History params={params} />
      </Suspense>
    </div>
  );
}

const fullDate = (day: string) => `${day.slice(0, 4)}. ${formatShortDate(day)}`;
const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

async function History({ params }: Pick<PageProps<"/kepzesek/dolgozo/[employeeId]">, "params">) {
  const [, { employeeId }] = await Promise.all([requireUser(), params]);
  const [employee, items] = await Promise.all([getEmployee(employeeId), trainingsOfEmployee(employeeId)]);
  if (!employee && !items.length) notFound();
  const name = employee?.name ?? items[0]?.participant.name ?? "Ismeretlen dolgozó";
  const today = dayKey(new Date());
  const passed = items.filter((item) => item.participant.exam === "megfelelt").length;
  const valid = items.filter((item) => item.participant.expiresAt && item.participant.expiresAt >= today).length;

  return (
    <div className="space-y-6">
      <div className="pg-rise">
        <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">Képzési előzmények</p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{name}</h1>
        {employee && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
            {[employee.position, employee.department].filter(Boolean).join(" · ")}
            <Pill tone={employee.status === "kilepett" ? "muted" : "info"}>{EMPLOYEE_STATUS[employee.status]}</Pill>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Képzés összesen" value={items.length} icon={GraduationCap} tone="text-rose-bright" />
        <Stat label="Sikeres vizsga" value={passed} icon={BadgeCheck} tone="text-pink-bright" />
        <Stat label="Érvényes tanúsítvány" value={valid} icon={TimerReset} />
      </div>

      <Panel title="Képzések" icon={GraduationCap}>
        {items.length === 0 ? (
          <Empty icon={GraduationCap} title="Még nem vett részt rögzített képzésen" />
        ) : (
          <ul className="divide-y divide-white/6">
            {items.map(({ training, participant }) => {
              const left = participant.expiresAt ? daysUntil(today, participant.expiresAt) : undefined;
              return (
                <li key={training.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/kepzesek/${training.id}`} className="font-medium hover:text-rose">
                      {training.name}
                    </Link>
                    <p className="text-xs text-white/50">
                      {TRAINING_TYPES[training.type]} · {fullDate(training.startDate)}
                      {participant.certificateNumber && ` · Tanúsítvány: ${participant.certificateNumber}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {participant.attendance && <Pill tone={participant.attendance === "hianyzott" ? "error" : "muted"}>{ATTENDANCE[participant.attendance]}</Pill>}
                      {participant.exam && (
                        <Pill tone={participant.exam === "megfelelt" ? "ok" : "error"}>
                          {EXAM_RESULTS[participant.exam]}
                          {participant.score !== undefined && ` · ${participant.score} pont`}
                        </Pill>
                      )}
                      {participant.studyContract && (
                        <Pill tone="warning">
                          Tanulmányi szerződés · {formatHuf(participant.studyAmount)}
                          {participant.repayment && ` · ${REPAYMENT_STATUS[participant.repayment]}`}
                        </Pill>
                      )}
                    </div>
                  </div>
                  {participant.expiresAt && left !== undefined ? (
                    <div className="text-right">
                      <p className="text-xs text-white/45">Lejár: {fullDate(participant.expiresAt)}</p>
                      <Pill tone={left < 0 ? "error" : left <= 90 ? "warning" : "ok"}>{left > 90 ? "Érvényes" : expiryText(left)}</Pill>
                    </div>
                  ) : (
                    <span className="text-xs text-white/40">{training.validityMonths ? "Nincs érvényes tanúsítvány" : "Nem jár le"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}


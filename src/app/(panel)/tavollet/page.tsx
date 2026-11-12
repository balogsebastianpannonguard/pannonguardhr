import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { AbsenceCalendar } from "@/components/absence-calendar";
import { AbsenceForm } from "@/components/absence-form";
import { AbsenceTabs } from "@/components/absence-tabs";
import { PageTitle } from "@/components/page-title";
import { Empty, Panel, Pill, Skeleton, Stat, buttonClass } from "@/components/ui";
import { absencesBetween, daysWithin } from "@/lib/absences";
import { ABSENCE_COLORS, ABSENCE_TYPES, eachDay, formatDays, isWorkday, type AbsenceType } from "@/lib/absences-meta";
import { addMonths, dayKey, formatMonth, formatShortDate } from "@/lib/dates";
import { employeeOptions } from "@/lib/employees";
import { MONTH } from "@/lib/form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Távollétek" };

export default function AbsencesPage({ searchParams }: PageProps<"/tavollet">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Állomány · Távollétek" title="Ki van" accent="távol?">
        Szabadság, betegség és minden más távollét egy naptárban. A munkanapokat a rendszer számolja (hétvége és ünnepnapok
        nélkül), és szól, ha valakinél átfedés lenne.
      </PageTitle>
      <AbsenceTabs current="/tavollet" />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Absences searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Absences({ searchParams }: Pick<PageProps<"/tavollet">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const today = dayKey(new Date());
  const raw = Array.isArray(params.ho) ? params.ho[0] : params.ho;
  const month = raw && MONTH.test(raw) && raw >= "2000-01" && raw <= "2100-12" ? raw : today.slice(0, 7);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [rows, options, todays] = await Promise.all([absencesBetween(first, last), employeeOptions(true), absencesBetween(today, today)]);

  const byType = new Map<AbsenceType, number>();
  for (const row of rows) byType.set(row.type, (byType.get(row.type) ?? 0) + daysWithin(row, first, last));
  const totalDays = [...byType.values()].reduce((sum, value) => sum + value, 0);
  const workdays = eachDay(first, last).filter(isWorkday).length;
  const people = new Set(rows.map((row) => row.employeeId)).size;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ma távol" value={todays.length} icon={CalendarOff} tone={todays.length ? "text-pink-bright" : "text-white"} hint={todays.slice(0, 3).map((row) => row.employeeName).join(", ") || "Mindenki dolgozik"} />
        <Stat label="Érintett dolgozó a hónapban" value={people} icon={Users} />
        <Stat label="Távolléti munkanap a hónapban" value={formatDays(totalDays)} icon={CalendarDays} tone="text-rose-bright" />
        <Stat label="Munkanap a hónapban" value={workdays} icon={CalendarDays} hint="Ünnepnapok és áthelyezések figyelembevételével" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Panel
            title={<span className="capitalize">{formatMonth(month)}</span>}
            icon={CalendarDays}
            action={
              <div className="flex items-center gap-1">
                <Link href={`/tavollet?ho=${addMonths(month, -1)}`} className={buttonClass("ghost", "sm")} aria-label="Előző hónap">
                  <ChevronLeft size={16} aria-hidden />
                </Link>
                {month !== today.slice(0, 7) && (
                  <Link href="/tavollet" className={buttonClass("secondary", "sm")}>
                    Ma
                  </Link>
                )}
                <Link href={`/tavollet?ho=${addMonths(month, 1)}`} className={buttonClass("ghost", "sm")} aria-label="Következő hónap">
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </div>
            }
          >
            <AbsenceCalendar month={month} rows={rows} today={today} />
          </Panel>

          <Panel title="A hónap távollétei" icon={CalendarOff} action={<Pill tone="muted">{rows.length} tétel</Pill>}>
            {rows.length === 0 ? (
              <Empty icon={CalendarOff} title="Ebben a hónapban nincs távollét" text="Az új távollétet a jobb oldali űrlapon rögzítheted." />
            ) : (
              <>
                {totalDays > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <div className="flex h-3 overflow-hidden rounded-full bg-white/5" role="img" aria-label="Távolléti napok típusonként">
                      {[...byType.entries()].map(([type, value]) => (
                        <span key={type} style={{ width: `${(value / totalDays) * 100}%`, background: ABSENCE_COLORS[type] }} title={`${ABSENCE_TYPES[type]}: ${formatDays(value)} nap`} />
                      ))}
                    </div>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                      {[...byType.entries()].map(([type, value]) => (
                        <span key={type}>
                          {ABSENCE_TYPES[type]}: <strong className="text-white/80">{formatDays(value)}</strong> nap
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                <ul className="divide-y divide-white/6">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <Link href={`/tavollet/${row.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2.5 hover:bg-white/4">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ABSENCE_COLORS[row.type] }} />
                        <span className="min-w-0 flex-1 truncate font-medium">{row.employeeName}</span>
                        <span className="text-xs text-white/55">{ABSENCE_TYPES[row.type]}</span>
                        <span className="text-xs text-white/55 tabular-nums">
                          {formatShortDate(row.from)}
                          {row.to !== row.from && ` – ${formatShortDate(row.to)}`}
                        </span>
                        <Pill tone="muted">{row.halfDay ? "fél nap" : `${formatDays(row.days)} nap`}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        <Panel title="Új távollét" icon={Plus}>
          <AbsenceForm key={month} options={options} defaultDay={month === today.slice(0, 7) ? today : first} />
        </Panel>
      </div>
    </div>
  );
}

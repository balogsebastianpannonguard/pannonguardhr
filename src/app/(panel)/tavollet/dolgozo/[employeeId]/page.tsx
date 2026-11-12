import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarOff, CalendarRange, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { AllowanceForm } from "@/components/absence-actions";
import { Empty, Panel, Pill, Skeleton, Stat, buttonClass } from "@/components/ui";
import { absencesBetween, daysWithin, getAllowance } from "@/lib/absences";
import { ABSENCE_COLORS, ABSENCE_TYPES, formatDays, type AbsenceType } from "@/lib/absences-meta";
import { dayKey, formatShortDate } from "@/lib/dates";
import { EMPLOYEE_STATUS, getEmployee } from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Éves távollét-áttekintés" };

export default function EmployeeAbsencePage({ params, searchParams }: PageProps<"/tavollet/dolgozo/[employeeId]">) {
  return (
    <div className="space-y-6">
      <Link href="/tavollet/keret" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Éves keretek
      </Link>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Overview params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Overview({ params, searchParams }: PageProps<"/tavollet/dolgozo/[employeeId]">) {
  const [, { employeeId }, query] = await Promise.all([requireUser(), params, searchParams]);
  const current = Number(dayKey(new Date()).slice(0, 4));
  const rawYear = Number(Array.isArray(query.ev) ? query.ev[0] : query.ev);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : current;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [employee, rows, allowance] = await Promise.all([getEmployee(employeeId), absencesBetween(start, end, employeeId), getAllowance(employeeId, year)]);
  if (!employee) notFound();

  const byType = new Map<AbsenceType, number>();
  for (const row of rows) byType.set(row.type, (byType.get(row.type) ?? 0) + daysWithin(row, start, end));
  const used = byType.get("szabadsag") ?? 0;
  const total = allowance ? allowance.days + (allowance.carryOver ?? 0) : undefined;
  const remaining = total === undefined ? undefined : total - used;

  return (
    <div className="space-y-6">
      <div className="pg-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">Távollétek · {year}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{employee.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
            {[employee.position, employee.department].filter(Boolean).join(" · ")}
            <Pill tone={employee.status === "kilepett" ? "muted" : "info"}>{EMPLOYEE_STATUS[employee.status]}</Pill>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/tavollet/dolgozo/${employeeId}?ev=${year - 1}`} className={buttonClass("ghost", "sm")} aria-label="Előző év">
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <span className="px-2 text-sm font-semibold tabular-nums">{year}</span>
          <Link href={`/tavollet/dolgozo/${employeeId}?ev=${year + 1}`} className={buttonClass("ghost", "sm")} aria-label="Következő év">
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Éves keret" value={total === undefined ? "–" : formatDays(total)} icon={CalendarRange} hint={allowance?.carryOver ? `ebből ${formatDays(allowance.carryOver)} áthozott` : allowance ? undefined : "Még nincs beállítva"} />
        <Stat label="Kivett szabadság" value={formatDays(used)} icon={CalendarOff} tone="text-pink-bright" />
        <Stat label="Maradék" value={remaining === undefined ? "–" : formatDays(remaining)} icon={CalendarRange} tone={remaining !== undefined && remaining < 0 ? "text-red-300" : "text-rose-bright"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Távollétek az évben" icon={CalendarOff}>
          {byType.size > 0 && (
            <p className="mb-3 flex flex-wrap gap-2">
              {[...byType.entries()].map(([type, value]) => (
                <span key={type} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: ABSENCE_COLORS[type] }} />
                  {ABSENCE_TYPES[type]}: <strong>{formatDays(value)}</strong> nap
                </span>
              ))}
            </p>
          )}
          {rows.length === 0 ? (
            <Empty icon={CalendarOff} title="Ebben az évben nincs rögzített távolléte" />
          ) : (
            <ul className="divide-y divide-white/6">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link href={`/tavollet/${row.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2.5 hover:bg-white/4">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ABSENCE_COLORS[row.type] }} />
                    <span className="min-w-0 flex-1 text-sm">{ABSENCE_TYPES[row.type]}</span>
                    <span className="text-xs text-white/55 tabular-nums">
                      {formatShortDate(row.from)}
                      {row.to !== row.from && ` – ${formatShortDate(row.to)}`}
                    </span>
                    <Pill tone="muted">{row.halfDay ? "fél nap" : `${formatDays(row.days)} nap`}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Éves keret" icon={Settings2}>
          <AllowanceForm key={year} employeeId={employeeId} year={year} days={allowance?.days} carryOver={allowance?.carryOver} note={allowance?.note} />
        </Panel>
      </div>
    </div>
  );
}

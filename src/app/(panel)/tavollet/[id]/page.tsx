import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarRange, Pencil } from "lucide-react";
import { DeleteAbsenceButton } from "@/components/absence-actions";
import { AbsenceForm } from "@/components/absence-form";
import { Panel, Skeleton } from "@/components/ui";
import { getAbsence } from "@/lib/absences";
import { ABSENCE_TYPES, formatDays } from "@/lib/absences-meta";
import { formatShortDate } from "@/lib/dates";
import { employeeOptions } from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Távollét" };

export default function AbsencePage({ params }: PageProps<"/tavollet/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/tavollet" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Távollétek
      </Link>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Absence params={params} />
      </Suspense>
    </div>
  );
}

async function Absence({ params }: Pick<PageProps<"/tavollet/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const [absence, options] = await Promise.all([getAbsence(id), employeeOptions(true)]);
  if (!absence) notFound();
  const back = `/tavollet?ho=${absence.from.slice(0, 7)}`;

  return (
    <div className="space-y-6">
      <div className="pg-rise flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">{ABSENCE_TYPES[absence.type]}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{absence.employeeName}</h1>
          <p className="mt-2 text-sm text-white/55">
            {absence.from.slice(0, 4)}. {formatShortDate(absence.from)}
            {absence.to !== absence.from && ` – ${formatShortDate(absence.to)}`} · {absence.halfDay ? "fél nap" : `${formatDays(absence.days)} munkanap`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/tavollet/dolgozo/${absence.employeeId}?ev=${absence.from.slice(0, 4)}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 text-sm hover:bg-white/10">
            <CalendarRange size={15} aria-hidden /> Éves áttekintés
          </Link>
          <DeleteAbsenceButton id={absence.id} back={back} />
        </div>
      </div>
      <Panel title="Módosítás" icon={Pencil} className="max-w-2xl">
        <AbsenceForm absence={absence} options={options} />
      </Panel>
    </div>
  );
}

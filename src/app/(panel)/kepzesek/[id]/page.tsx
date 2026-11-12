import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BadgeCheck, ClipboardList, Coins, Pencil, Printer, Users } from "lucide-react";
import { DeleteTrainingButton } from "@/components/training-actions";
import { TrainingForm } from "@/components/training-form";
import { TrainingResultsForm } from "@/components/training-results-form";
import { Empty, Panel, Pill, Skeleton, Stat, buttonClass } from "@/components/ui";
import { dayKey, formatShortDate } from "@/lib/dates";
import { employeeOptions } from "@/lib/employees";
import { requireUser } from "@/lib/session";
import { getTraining } from "@/lib/trainings";
import { TRAINING_TYPES, formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Képzés" };

export default function TrainingPage({ params }: PageProps<"/kepzesek/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/kepzesek" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Képzések
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Training params={params} />
      </Suspense>
    </div>
  );
}

async function Training({ params }: Pick<PageProps<"/kepzesek/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const [training, options] = await Promise.all([getTraining(id), employeeOptions(true)]);
  if (!training) notFound();
  const today = dayKey(new Date());
  const passed = training.participants.filter((item) => item.exam === "megfelelt").length;
  const examined = training.participants.filter((item) => item.exam).length;
  const present = training.participants.filter((item) => item.attendance === "jelen" || item.attendance === "reszben").length;

  return (
    <div className="space-y-6">
      <div className="pg-rise flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.22em] text-rose uppercase">{TRAINING_TYPES[training.type]}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{training.name}</h1>
          <p className="mt-2 text-sm text-white/55">
            {formatShortDate(training.startDate)}
            {training.endDate && ` – ${formatShortDate(training.endDate)}`}, {training.startDate.slice(0, 4)}
            {training.location && ` · ${training.location}`}
            {training.trainer && ` · Oktató: ${training.trainer}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/kepzesek/${training.id}/jelenleti-iv`} className={buttonClass("secondary", "sm")}>
            <Printer size={15} aria-hidden /> Jelenléti ív
          </Link>
          <DeleteTrainingButton id={training.id} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Résztvevő" value={training.participants.length} icon={Users} tone="text-rose-bright" />
        <Stat label="Jelen volt" value={present} icon={ClipboardList} hint="Jelen vagy részben jelen" />
        <Stat label="Megfelelt" value={examined ? `${passed}/${examined}` : "–"} icon={BadgeCheck} tone="text-pink-bright" />
        <Stat label="Költség" value={formatHuf(training.cost)} icon={Coins} hint={training.validityMonths ? `Érvényesség: ${training.validityMonths} hónap` : "Nem jár le"} />
      </div>
      {training.notes && <p className="pg-card rounded-2xl p-4 text-sm whitespace-pre-wrap text-white/65">{training.notes}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Panel title="Résztvevők és eredmények" icon={BadgeCheck} action={<Pill tone="muted">{training.participants.length} fő</Pill>}>
          {training.participants.length === 0 ? (
            <Empty icon={Users} title="Még nincs résztvevő" text="A jobb oldali űrlapon választhatod ki a résztvevőket a dolgozói listából." />
          ) : (
            <TrainingResultsForm training={training} today={today} />
          )}
        </Panel>
        <Panel title="Adatok és résztvevők" icon={Pencil}>
          <TrainingForm training={training} options={options} />
        </Panel>
      </div>
    </div>
  );
}

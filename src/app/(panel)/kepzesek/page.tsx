import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, CalendarDays, Coins, Filter, GraduationCap, Plus, SearchX, TimerReset, Users } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { TrainingForm } from "@/components/training-form";
import { TrainingTabs } from "@/components/training-tabs";
import { Empty, Input, Panel, Pill, Select, Skeleton, Stat, buttonClass } from "@/components/ui";
import { dayKey, formatShortDate } from "@/lib/dates";
import { employeeOptions } from "@/lib/employees";
import { requireUser } from "@/lib/session";
import { listTrainings, trainingExpiries } from "@/lib/trainings";
import { TRAINING_TYPES, formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Képzések" };

export default function TrainingsPage({ searchParams }: PageProps<"/kepzesek">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Munkaügy · Képzések" title="Képzések és" accent="oktatások.">
        A képzések, résztvevők, vizsgák és tanúsítványok egy helyen. A lejáratokat a rendszer számolja, így időben
        szervezheted az ismétlő oktatásokat.
      </PageTitle>
      <TrainingTabs current="/kepzesek" />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Trainings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

async function Trainings({ searchParams }: Pick<PageProps<"/kepzesek">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const filter = { q: one(params.q), type: one(params.tipus), year: one(params.ev) };
  const [rows, all, options, expiring] = await Promise.all([listTrainings(filter), listTrainings(), employeeOptions(true), trainingExpiries(90)]);
  const today = dayKey(new Date());
  const year = today.slice(0, 4);
  const thisYear = all.filter((row) => row.startDate.startsWith(year));
  const years = [...new Set(all.map((row) => row.startDate.slice(0, 4)))].sort().reverse();
  const filtered = Boolean(filter.q || filter.type || filter.year);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Képzés ${year}-ben`} value={thisYear.length} icon={GraduationCap} tone="text-rose-bright" />
        <Stat label="Résztvevő idén" value={thisYear.reduce((sum, row) => sum + row.participants.length, 0)} icon={Users} tone="text-pink-bright" />
        <Stat label="Képzési költség idén" value={formatHuf(thisYear.reduce((sum, row) => sum + (row.cost ?? 0), 0))} icon={Coins} />
        <Link href="/kepzesek/lejaratok" className="block rounded-2xl hover:bg-white/3">
          <Stat
            label="Lejáró / lejárt tanúsítvány"
            value={expiring.length}
            icon={TimerReset}
            tone={expiring.some((item) => item.daysLeft < 0) ? "text-red-300" : expiring.length ? "text-amber-300" : "text-white"}
            hint="90 napon belül vagy már lejárt"
          />
        </Link>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-4">
          <form method="get" className="pg-panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
            <label className="min-w-44 flex-[2]">
              <span className="mb-1 block text-xs text-white/50">Keresés</span>
              <Input name="q" type="search" defaultValue={filter.q} placeholder="Név, oktató, helyszín, résztvevő" />
            </label>
            <label className="min-w-36 flex-1">
              <span className="mb-1 block text-xs text-white/50">Típus</span>
              <Select name="tipus" defaultValue={filter.type}>
                <option value="">Mind</option>
                {Object.entries(TRAINING_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="min-w-24 flex-1">
              <span className="mb-1 block text-xs text-white/50">Év</span>
              <Select name="ev" defaultValue={filter.year}>
                <option value="">Mind</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" className={buttonClass("secondary")}>
              <Filter size={16} aria-hidden /> Szűrés
            </button>
            {filtered && (
              <Link href="/kepzesek" className={buttonClass("ghost")}>
                Törlés
              </Link>
            )}
          </form>

          {rows.length === 0 ? (
            <Empty
              icon={filtered ? SearchX : GraduationCap}
              title={filtered ? "Nincs a szűrésnek megfelelő képzés" : "Még nincs rögzített képzés"}
              text={filtered ? "Módosítsd a szűrést." : "Vedd fel az első képzést a jobb oldali űrlappal – a résztvevőket a dolgozói listából választhatod."}
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const passed = row.participants.filter((item) => item.exam === "megfelelt").length;
                const failed = row.participants.filter((item) => item.exam === "nem_felelt_meg").length;
                const contracts = row.participants.filter((item) => item.studyContract).length;
                const upcoming = row.startDate > today;
                return (
                  <li key={row.id}>
                    <Link href={`/kepzesek/${row.id}`} className="pg-card block rounded-2xl p-4 hover:bg-white/5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{row.name}</span>
                        <Pill tone="info">{TRAINING_TYPES[row.type]}</Pill>
                        {upcoming && <Pill tone="muted">Tervezett</Pill>}
                      </div>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={13} aria-hidden />
                          {formatShortDate(row.startDate)}
                          {row.endDate && ` – ${formatShortDate(row.endDate)}`}, {row.startDate.slice(0, 4)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} aria-hidden /> {row.participants.length} résztvevő
                        </span>
                        {passed + failed > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <BadgeCheck size={13} aria-hidden /> {passed} megfelelt{failed ? `, ${failed} nem` : ""}
                          </span>
                        )}
                        {row.validityMonths && <span>Érvényes {row.validityMonths} hónapig</span>}
                        {row.trainer && <span>Oktató: {row.trainer}</span>}
                        {contracts > 0 && <span className="text-amber-200">{contracts} tanulmányi szerződés</span>}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Panel title="Új képzés" icon={Plus}>
          <TrainingForm options={options} />
        </Panel>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, CircleAlert, Search, Users } from "lucide-react";
import { AbsenceTabs } from "@/components/absence-tabs";
import { PageTitle } from "@/components/page-title";
import { Empty, Input, Panel, Pill, Skeleton, Stat, buttonClass } from "@/components/ui";
import { yearOverview } from "@/lib/absences";
import { ABSENCE_TYPES, formatDays, type AbsenceType } from "@/lib/absences-meta";
import { dayKey } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Éves szabadságkeretek" };

export default function AllowancesPage({ searchParams }: PageProps<"/tavollet/keret">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Állomány · Távollétek" title="Éves" accent="keretek.">
        Dolgozónként a szabadságkeret, a felhasznált és a maradék napok, valamint a többi távollét. A keretet a dolgozó
        nevére kattintva állíthatod be.
      </PageTitle>
      <AbsenceTabs current="/tavollet/keret" />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Allowances searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const OTHER: AbsenceType[] = ["betegszabadsag", "tappenz", "fizetes_nelkuli", "igazolatlan", "tanulmanyi", "egyeb"];

async function Allowances({ searchParams }: Pick<PageProps<"/tavollet/keret">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const current = Number(dayKey(new Date()).slice(0, 4));
  const rawYear = Number(Array.isArray(params.ev) ? params.ev[0] : params.ev);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : current;
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const all = await yearOverview(year);
  const rows = q ? all.filter((row) => `${row.name} ${row.position} ${row.department ?? ""}`.toLocaleLowerCase("hu").includes(q.toLocaleLowerCase("hu"))) : all;
  const missing = all.filter((row) => row.allowance === undefined).length;
  const over = all.filter((row) => row.remaining !== undefined && row.remaining < 0).length;
  const used = all.reduce((sum, row) => sum + row.used, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Dolgozó" value={all.length} icon={Users} />
        <Stat label={`Kivett szabadság ${year}`} value={formatDays(used)} icon={CalendarRange} tone="text-rose-bright" hint="munkanap összesen" />
        <Stat label="Hiányzó keret" value={missing} icon={CircleAlert} tone={missing ? "text-amber-300" : "text-white"} hint="Nincs beállítva éves keret" />
        <Stat label="Túllépett keret" value={over} icon={CircleAlert} tone={over ? "text-red-300" : "text-white"} />
      </div>

      <Panel
        title={`${year}. év`}
        icon={CalendarRange}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="ev" value={year} />
              <Input name="q" type="search" defaultValue={q} placeholder="Keresés" aria-label="Keresés név szerint" className="h-9 w-44 text-sm" />
              <button type="submit" className={buttonClass("secondary", "sm")} aria-label="Keresés">
                <Search size={15} aria-hidden />
              </button>
            </form>
            <Link href={`/tavollet/keret?ev=${year - 1}`} className={buttonClass("ghost", "sm")} aria-label="Előző év">
              <ChevronLeft size={16} aria-hidden />
            </Link>
            <Link href={`/tavollet/keret?ev=${year + 1}`} className={buttonClass("ghost", "sm")} aria-label="Következő év">
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty icon={Users} title={q ? "Nincs találat" : "Még nincs dolgozó"} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/50">
                    <th className="py-2 pr-3 font-medium">Dolgozó</th>
                    <th className="px-2 py-2 text-right font-medium">Keret</th>
                    <th className="px-2 py-2 text-right font-medium">Áthozott</th>
                    <th className="px-2 py-2 text-right font-medium">Kivett</th>
                    <th className="px-2 py-2 text-right font-medium">Maradék</th>
                    <th className="py-2 pl-3 font-medium">Egyéb távollét</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.employeeId} className="border-b border-white/5">
                      <td className="py-2.5 pr-3">
                        <Link href={`/tavollet/dolgozo/${row.employeeId}?ev=${year}`} className="font-medium hover:text-rose">
                          {row.name}
                        </Link>
                        <p className="text-xs text-white/45">{row.position}</p>
                      </td>
                      <td className="px-2 text-right tabular-nums">{row.allowance === undefined ? <Pill tone="warning">nincs</Pill> : formatDays(row.allowance)}</td>
                      <td className="px-2 text-right text-white/60 tabular-nums">{row.carryOver ? formatDays(row.carryOver) : "–"}</td>
                      <td className="px-2 text-right tabular-nums">{formatDays(row.used)}</td>
                      <td className={`px-2 text-right font-semibold tabular-nums ${row.remaining !== undefined && row.remaining < 0 ? "text-red-300" : "text-rose-bright"}`}>
                        {row.remaining === undefined ? "–" : formatDays(row.remaining)}
                      </td>
                      <td className="py-2.5 pl-3 text-xs text-white/55">{otherText(row.byType) || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 lg:hidden">
              {rows.map((row) => (
                <li key={row.employeeId}>
                  <Link href={`/tavollet/dolgozo/${row.employeeId}?ev=${year}`} className="pg-card block rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-xs text-white/45">{row.position}</p>
                      </div>
                      {row.allowance === undefined ? (
                        <Pill tone="warning">nincs keret</Pill>
                      ) : (
                        <Pill tone={row.remaining !== undefined && row.remaining < 0 ? "error" : "info"}>{formatDays(row.remaining ?? 0)} nap maradt</Pill>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-white/55">
                      Kivett: {formatDays(row.used)} nap
                      {row.allowance !== undefined && ` / ${formatDays(row.allowance + (row.carryOver ?? 0))}`}
                      {otherText(row.byType) && ` · ${otherText(row.byType)}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function otherText(byType: Partial<Record<AbsenceType, number>>) {
  return OTHER.filter((type) => byType[type])
    .map((type) => `${ABSENCE_TYPES[type]}: ${formatDays(byType[type]!)}`)
    .join(", ");
}

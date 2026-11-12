import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { BarChart, DonutChart, HBarChart, LineChart } from "@/components/charts";
import { ReportNarrative } from "@/components/report-narrative";
import { ReportPeriodForm } from "@/components/report-period-form";
import { Skeleton } from "@/components/ui";
import { ABSENCE_TYPES, type AbsenceType } from "@/lib/absences-meta";
import { aiAvailable } from "@/lib/ai";
import { dayKey, formatShortDate } from "@/lib/dates";
import { buildReport, formatNumber, resolvePeriod, shortMonth } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Vezetői HR-riport" };
export const maxDuration = 120;

export default function LeadershipReportPage({ searchParams }: PageProps<"/kimutatasok/riport">) {
  return (
    <div className="space-y-6">
      <Link href="/kimutatasok" className="print-hidden inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Kimutatások
      </Link>
      <Suspense fallback={<Skeleton className="h-[60rem]" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/kimutatasok/riport">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const today = dayKey(new Date());
  const period = resolvePeriod(params, today);
  const data = await buildReport(period);
  const { headcount: h, absence: a, training: t } = data;
  const multiYear = period.fromMonth.slice(0, 4) !== period.toMonth.slice(0, 4);
  const labels = period.months.map((month, index) => shortMonth(month, multiYear && (index === 0 || month.endsWith("-01"))));
  const absenceTypes = (Object.keys(ABSENCE_TYPES) as AbsenceType[]).filter((type) => a.byType.some((item) => item.type === type));

  const kpis: [string, string, string?][] = [
    ["Létszám az időszak végén", `${h.closing} fő`, `nyitó ${h.opening} fő, átlag ${formatNumber(h.average)} fő`],
    ["Belépők", `${h.joiners} fő`],
    ["Kilépők", `${h.leavers} fő`],
    ["Fluktuáció", `${formatNumber(h.fluctuation)}%`, `${h.leavers} ÷ ${formatNumber(h.average)} × 100`],
    ["Távolléti munkanap", formatNumber(a.totalDays), `ráta: ${formatNumber(a.rate)}% (${a.workdays} munkanap)`],
    ["Képzések", `${t.held} db`, `${t.participants} részvétel, ${formatHuf(t.cost)}`],
    ["Vizsga-sikeresség", t.passRate === null ? "–" : `${formatNumber(t.passRate)}%`, `${t.passed} megfelelt, ${t.failed} nem felelt meg`],
    ["Tanúsítványok", `${t.expired} lejárt`, `${t.expiring} jár le 90 napon belül`],
  ];

  return (
    <div className="space-y-6">
      <ReportPeriodForm action="/kimutatasok/riport" period={period.key} from={period.fromMonth} to={period.toMonth} max={today.slice(0, 7)} />

      <article className="mx-auto w-full max-w-[52rem] rounded-2xl bg-white px-5 py-8 text-[#14182b] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <div className="border-b-2 border-[#14182b] pb-4">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#4b5563] uppercase">PannonGuard Biztonsági Szolgáltató Zrt. · HR</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Vezetői HR-riport</h1>
          <p className="mt-1 text-sm text-[#4b5563]">
            Időszak: {period.label} · Kelt: {today.slice(0, 4)}. {formatShortDate(today)} · Összeállította: {user.name}
          </p>
        </div>

        <section className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-bold">Fő számok</h2>
          <table className="mt-3 w-full border-collapse text-sm">
            <tbody>
              {kpis.map(([label, value, note]) => (
                <tr key={label} className="border-b border-[#e5e7eb]">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-[#4b5563]">
                    {label}
                  </th>
                  <td className="py-1.5 pr-3 text-right font-bold tabular-nums">{value}</td>
                  <td className="hidden py-1.5 text-xs text-[#6b7280] sm:table-cell print:table-cell">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-[#6b7280]">
            Fluktuáció = kilépők száma ÷ átlagos létszám × 100; az átlagos létszám a havi záró létszámok átlaga. Távolléti ráta = távolléti
            munkanapok ÷ (átlagos létszám × munkanapok) × 100.
          </p>
        </section>

        <div className="mt-8">
          <ReportNarrative period={period.query} params={{ idoszak: period.key, ...(period.key === "egyedi" && { tol: period.fromMonth, ig: period.toMonth }) }} aiOn={aiAvailable()} />
        </div>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-bold">Létszám alakulása</h2>
          <div className="mt-3">
            <LineChart theme="light" label="Havi létszám" labels={labels} series={[{ name: "Létszám", values: h.months.map((row) => row.headcount) }]} height={200} />
          </div>
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-bold">Belépők és kilépők</h2>
          <div className="mt-3">
            <BarChart
              theme="light"
              label="Belépők és kilépők havonta"
              labels={labels}
              height={200}
              series={[
                { name: "Belépő", values: h.months.map((row) => row.joiners), color: "#c9806d" },
                { name: "Kilépő", values: h.months.map((row) => row.leavers), color: "#5d6fd6" },
              ]}
            />
          </div>
        </section>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 print:grid-cols-2">
          <section className="break-inside-avoid">
            <h2 className="text-lg font-bold">Kilépések oka</h2>
            <div className="mt-3">
              <DonutChart theme="light" label="Kilépések oka" items={h.exitsByReason} centerLabel="kilépő" />
            </div>
          </section>
          <section className="break-inside-avoid">
            <h2 className="text-lg font-bold">Távollét típus szerint</h2>
            <div className="mt-3">
              <DonutChart theme="light" label="Távolléti munkanapok típus szerint" items={a.byType} centerLabel="munkanap" />
            </div>
          </section>
        </div>

        <section className="mt-8 break-inside-avoid">
          <h2 className="text-lg font-bold">Távollét havonta</h2>
          <div className="mt-3">
            <BarChart
              theme="light"
              stacked
              height={200}
              label="Távolléti munkanapok havonta típusonként"
              labels={labels}
              series={absenceTypes.map((type) => ({ name: ABSENCE_TYPES[type], values: a.byMonth.map((row) => row.values[type] ?? 0) }))}
            />
          </div>
        </section>

        <div className="mt-8 grid gap-8 sm:grid-cols-2 print:grid-cols-2">
          <section className="break-inside-avoid">
            <h2 className="text-lg font-bold">Létszám munkakör szerint</h2>
            <div className="mt-3">
              <HBarChart theme="light" label="Létszám munkakör szerint" items={h.byPosition} max={8} unit=" fő" color="#c9806d" />
            </div>
          </section>
          <section className="break-inside-avoid">
            <h2 className="text-lg font-bold">Képzések típus szerint</h2>
            <div className="mt-3">
              <HBarChart theme="light" label="Képzések típus szerint" items={t.byType} unit=" db" color="#5d6fd6" />
            </div>
          </section>
        </div>

        <p className="mt-10 border-t border-[#d1d5db] pt-3 text-xs text-[#6b7280]">
          A riport a PannonGuard HR-rendszer adataiból készült ({formatShortDate(data.generatedAt.slice(0, 10))}). A számok összesítettek, személyes adatot
          nem tartalmaznak.
          {(data.quality.missingStart > 0 || data.quality.exitedWithoutDate > 0) &&
            ` Adatminőség: ${data.quality.missingStart} dolgozónál hiányzik a belépés, ${data.quality.exitedWithoutDate} kilépettnél a kilépés dátuma.`}
        </p>
      </article>
    </div>
  );
}

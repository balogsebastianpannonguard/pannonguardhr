import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, CalendarOff, CircleAlert, FileSignature, FileText, GraduationCap, TimerReset, TrendingDown, UserPlus, Users } from "lucide-react";
import { BarChart, DonutChart, HBarChart, LineChart } from "@/components/charts";
import { PageTitle } from "@/components/page-title";
import { ReportChartCard } from "@/components/report-chart-card";
import { ReportPeriodForm } from "@/components/report-period-form";
import { Skeleton, Stat, buttonClass } from "@/components/ui";
import { ABSENCE_COLORS, ABSENCE_TYPES, type AbsenceType } from "@/lib/absences-meta";
import { dayKey } from "@/lib/dates";
import { buildReport, formatNumber, reportTables, resolvePeriod, shortMonth } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Kimutatások" };

export default function ReportsPage({ searchParams }: PageProps<"/kimutatasok">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Tudás és riport · Kimutatások" title="HR-mutatók" accent="egy pillantásra.">
        Létszám, belépések és kilépések, fluktuáció, távollétek és képzések a választott időszakra. Minden diagram
        táblázatként is megnézhető és CSV-ben letölthető.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[60rem]" />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Reports({ searchParams }: Pick<PageProps<"/kimutatasok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const today = dayKey(new Date());
  const period = resolvePeriod(params, today);
  const data = await buildReport(period);
  const tables = reportTables(data);
  const { headcount: h, absence: a, training: t } = data;
  const multiYear = period.fromMonth.slice(0, 4) !== period.toMonth.slice(0, 4);
  const labels = period.months.map((month, index) => shortMonth(month, multiYear && (index === 0 || month.endsWith("-01"))));
  const absenceTypes = (Object.keys(ABSENCE_TYPES) as AbsenceType[]).filter((type) => a.byType.some((item) => item.type === type));
  const file = (name: string) => `${name}_${period.fromMonth}_${period.toMonth}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ReportPeriodForm action="/kimutatasok" period={period.key} from={period.fromMonth} to={period.toMonth} max={today.slice(0, 7)} />
        </div>
        <Link href={`/kimutatasok/riport?${period.query}`} className={buttonClass("primary")}>
          <FileText size={17} aria-hidden /> Vezetői riport
        </Link>
      </div>
      <p className="text-sm text-white/55">
        Időszak: <strong className="text-white/80">{period.label}</strong>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Létszám (időszak végén)" value={h.closing} icon={Users} tone="text-rose-bright" hint={`Nyitó: ${h.opening} · átlag: ${formatNumber(h.average)}`} />
        <Stat label="Belépő / kilépő" value={`${h.joiners} / ${h.leavers}`} icon={UserPlus} tone="text-pink-bright" />
        <Stat label="Fluktuáció" value={`${formatNumber(h.fluctuation)}%`} icon={TrendingDown} hint="kilépők ÷ átlagos létszám" />
        <Stat label="Távolléti ráta" value={`${formatNumber(a.rate)}%`} icon={CalendarOff} hint={`${formatNumber(a.totalDays)} távolléti munkanap`} />
        <Stat label="Képzés az időszakban" value={t.held} icon={GraduationCap} hint={`${t.participants} részvétel · ${formatHuf(t.cost)}`} />
        <Stat label="Vizsga-sikeresség" value={t.passRate === null ? "–" : `${formatNumber(t.passRate)}%`} icon={BadgeCheck} hint={`${t.passed} megfelelt, ${t.failed} nem`} />
        <Link href="/kepzesek/lejaratok" className="block rounded-2xl hover:bg-white/3">
          <Stat label="Lejáró tanúsítvány (90 nap)" value={t.expiring} icon={TimerReset} tone={t.expiring ? "text-amber-300" : "text-white"} hint={t.expired ? `és ${t.expired} már lejárt` : "Lejárt nincs"} />
        </Link>
        <Stat label="Tanulmányi szerződés" value={t.studyContracts} icon={FileSignature} hint="az időszak képzésein" />
      </div>

      {(data.quality.missingStart > 0 || data.quality.exitedWithoutDate > 0) && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/8 p-4 text-sm text-amber-100">
          <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            Adatminőség: {data.quality.missingStart} aktív dolgozónál hiányzik a belépés dátuma (őket a teljes időszakban számoljuk),{" "}
            {data.quality.exitedWithoutDate} kilépett dolgozónál a kilépés dátuma (ők kimaradnak a létszámból). Pótold a{" "}
            <Link href="/munkavallalok" className="underline">
              Munkavállalók
            </Link>{" "}
            oldalon a pontosabb kimutatáshoz.
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportChartCard title="Létszám alakulása" note="A hónap utolsó napján (a folyó hónapban ma) állományban lévők." filename={file("letszam")} table={tables.headcount}>
          <LineChart label="Havi létszám" labels={labels} series={[{ name: "Létszám", values: h.months.map((row) => row.headcount) }]} />
        </ReportChartCard>
        <ReportChartCard title="Belépők és kilépők havonta" filename={file("be-kilepes")} table={tables.flow}>
          <BarChart
            label="Belépők és kilépők havonta"
            labels={labels}
            series={[
              { name: "Belépő", values: h.months.map((row) => row.joiners), color: "#e8a796" },
              { name: "Kilépő", values: h.months.map((row) => row.leavers), color: "#8fa2ff" },
            ]}
          />
        </ReportChartCard>
      </div>

      <section className="pg-panel rounded-3xl p-5 sm:p-6">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose">
            <TrendingDown size={16} aria-hidden />
          </span>
          Fluktuáció
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-display text-4xl font-semibold text-rose-bright tabular-nums">{formatNumber(h.fluctuation)}%</p>
          <div className="min-w-0 text-sm text-white/65">
            <p className="font-mono text-xs text-white/50 sm:text-sm">Fluktuáció = kilépők száma ÷ átlagos létszám × 100</p>
            <p className="mt-1 font-mono text-xs sm:text-sm">
              = {h.leavers} ÷ {formatNumber(h.average)} × 100 = <strong className="text-white">{formatNumber(h.fluctuation)}%</strong>
            </p>
            <p className="mt-1 text-xs text-white/45">
              Az átlagos létszám a havi záró létszámok átlaga ({period.months.length} hónap). Rövidebb időszaknál az érték az időszakra vonatkozik, nem évesített.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportChartCard title="Létszám munkakör szerint" note="Az időszak végén." filename={file("munkakor")} table={tables.position}>
          <HBarChart label="Létszám munkakör szerint" items={h.byPosition} color="#e8a796" unit=" fő" />
        </ReportChartCard>
        <ReportChartCard title="Létszám szervezeti egység szerint" note="Az időszak végén." filename={file("egyseg")} table={tables.department}>
          <HBarChart label="Létszám szervezeti egység szerint" items={h.byDepartment} color="#e9679b" unit=" fő" />
        </ReportChartCard>
        <ReportChartCard title="Kilépések oka" note={`${h.leavers} kilépés az időszakban.`} filename={file("kilepes-okok")} table={tables.exits}>
          <DonutChart label="Kilépések oka" items={h.exitsByReason} centerLabel="kilépő" />
        </ReportChartCard>
        <ReportChartCard title="Távollét típus szerint" note="Munkanapban (hétvége és ünnepnap nélkül)." filename={file("tavollet-tipus")} table={tables.absenceType}>
          <DonutChart label="Távolléti munkanapok típus szerint" items={a.byType.map((item) => ({ ...item, color: ABSENCE_COLORS[item.type] }))} centerLabel="munkanap" />
        </ReportChartCard>
        <ReportChartCard title="Távollét havonta" note="Munkanap, típusonként halmozva." filename={file("tavollet-havi")} table={tables.absenceMonth} className="lg:col-span-2">
          <BarChart
            label="Távolléti munkanapok havonta típusonként"
            labels={labels}
            stacked
            series={absenceTypes.map((type) => ({ name: ABSENCE_TYPES[type], values: a.byMonth.map((row) => row.values[type] ?? 0), color: ABSENCE_COLORS[type] }))}
          />
        </ReportChartCard>
        <ReportChartCard
          title="Képzések típus szerint"
          note={`${t.held} képzés, ${t.participants} részvétel, ${t.uniqueParticipants} különböző dolgozó.`}
          filename={file("kepzesek")}
          table={tables.trainingType}
          className="lg:col-span-2"
        >
          <HBarChart label="Képzések típus szerint" items={t.byType} color="#8fa2ff" unit=" db" />
        </ReportChartCard>
      </div>
    </div>
  );
}

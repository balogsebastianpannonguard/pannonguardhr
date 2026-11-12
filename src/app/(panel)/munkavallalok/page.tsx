import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, Download, FileUp, Search, SearchX, UserRoundPlus, Users } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { Empty, Input, Pill, Select, Skeleton, buttonClass } from "@/components/ui";
import { dayKey } from "@/lib/dates";
import {
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_SHORT,
  EMPLOYEE_STATUS_TONE,
  EMPLOYMENT_TYPES,
  employeeFacets,
  employeeStatusCounts,
  expiriesOf,
  expiryText,
  expiryTone,
  formatDate,
  isStatus,
  listEmployees,
  type Employee,
  type EmployeeQuery,
  type EmployeeStatus,
} from "@/lib/employees";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Munkavállalók" };

export default function EmployeesPage({ searchParams }: PageProps<"/munkavallalok">) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Állomány" title="Munkavállalók" accent="nyilvántartása.">
          Törzsadatok, munkaviszony, végzettségek és lejáratok egy helyen. Keress névre, munkakörre, objektumra vagy képesítésre.
        </PageTitle>
        <div className="flex flex-wrap gap-2">
          <Link href="/munkavallalok/import" className={buttonClass("secondary")}>
            <FileUp size={16} aria-hidden /> Import
          </Link>
          <Link href="/munkavallalok/uj" className={buttonClass("primary")}>
            <UserRoundPlus size={17} aria-hidden /> Új munkavállaló
          </Link>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Employees searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

async function Employees({ searchParams }: Pick<PageProps<"/munkavallalok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const filter = {
    q: one(params.q).trim().slice(0, 100),
    status: one(params.status),
    position: one(params.position),
    department: one(params.department),
  };
  const query: EmployeeQuery = {
    q: filter.q || undefined,
    status: filter.status === "all" ? "all" : isStatus(filter.status) ? filter.status : undefined,
    position: filter.position || undefined,
    department: filter.department || undefined,
  };
  const [list, counts, facets] = await Promise.all([listEmployees(query), employeeStatusCounts(), employeeFacets()]);
  const today = dayKey(new Date());
  const filtered = Boolean(filter.q || filter.status || filter.position || filter.department);

  const href = (changes: Record<string, string>) => {
    const next = new URLSearchParams(Object.entries({ ...filter, ...changes }).filter(([, value]) => value));
    const qs = next.toString();
    return qs ? `/munkavallalok?${qs}` : "/munkavallalok";
  };
  const exportQuery = new URLSearchParams(Object.entries(filter).filter(([, value]) => value)).toString();
  const total = counts.aktiv + counts.belepes + counts.szunetel;

  const chips: { key: string; label: string; count: number; tone?: string }[] = [
    { key: "", label: "Jelenlegi állomány", count: total },
    ...(["aktiv", "belepes", "szunetel", "kilepett"] as EmployeeStatus[]).map((key) => ({ key, label: EMPLOYEE_STATUS_SHORT[key], count: counts[key] })),
    { key: "all", label: "Kilépettekkel együtt", count: total + counts.kilepett },
  ];

  return (
    <div className="space-y-5">
      {params.torolve === "1" && (
        <p className="pg-rise flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100">
          <CircleCheck size={16} aria-hidden /> A munkavállaló adatait véglegesen töröltem.
        </p>
      )}

      <nav aria-label="Állapot szerinti szűrés" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = filter.status === chip.key;
          return (
            <Link
              key={chip.key || "current"}
              href={href({ status: chip.key })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
                active ? "bg-rose/20 font-semibold text-rose-bright ring-1 ring-rose/40" : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              {chip.label}
              <span className="tabular-nums text-xs opacity-70">{chip.count}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" className="pg-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <label className="sm:col-span-2 lg:col-span-1">
          <span className="mb-1 block text-xs text-white/50">Keresés</span>
          <Input name="q" type="search" defaultValue={filter.q} placeholder="Név, e-mail, telefon, munkakör, képesítés…" />
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/50">Munkakör</span>
          <Select name="position" defaultValue={filter.position}>
            <option value="">Mind</option>
            {facets.positions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="mb-1 block text-xs text-white/50">Egység / objektum</span>
          <Select name="department" defaultValue={filter.department}>
            <option value="">Mind</option>
            {facets.departments.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className={`${buttonClass("secondary")} flex-1 lg:flex-none`}>
            <Search size={16} aria-hidden /> Keresés
          </button>
          {filtered && (
            <Link href="/munkavallalok" className={buttonClass("ghost")}>
              Törlés
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          <span className="font-semibold text-white tabular-nums">{list.length}</span> munkavállaló
          {filter.status && isStatus(filter.status) ? ` · ${EMPLOYEE_STATUS[filter.status]}` : filter.status === "all" ? " · kilépettekkel együtt" : ""}
        </p>
        <a href={`/munkavallalok/export${exportQuery ? `?${exportQuery}` : ""}`} className={buttonClass("ghost", "sm")} download>
          <Download size={15} aria-hidden /> Export (CSV)
        </a>
      </div>

      {list.length === 0 ? (
        <Empty
          icon={filtered ? SearchX : Users}
          title={filtered ? "Nincs találat" : "Még nincs munkavállaló a nyilvántartásban"}
          text={filtered ? "Próbálj más keresőszót vagy szűrést." : "Vedd fel az első kollégát, vagy töltsd be a meglévő Excel-táblázatodat CSV-importtal."}
          action={
            !filtered && (
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/munkavallalok/uj" className={buttonClass("primary")}>
                  <UserRoundPlus size={17} aria-hidden /> Új munkavállaló
                </Link>
                <Link href="/munkavallalok/import" className={buttonClass("secondary")}>
                  <FileUp size={16} aria-hidden /> CSV-import
                </Link>
              </div>
            )
          }
        />
      ) : (
        <>
          <div className="pg-panel hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-white/8 text-xs text-white/50">
                <tr>
                  <th className="w-[26%] px-4 py-3 font-medium">Név</th>
                  <th className="w-[18%] px-3 py-3 font-medium">Munkakör</th>
                  <th className="w-[18%] px-3 py-3 font-medium">Egység</th>
                  <th className="hidden w-[13%] px-3 py-3 font-medium xl:table-cell">Jogviszony</th>
                  <th className="hidden w-[10%] px-3 py-3 font-medium lg:table-cell">Belépés</th>
                  <th className="w-[15%] px-3 py-3 font-medium">Legközelebbi lejárat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.map((employee) => (
                  <tr key={employee.id} className="transition hover:bg-white/4">
                    <td className="px-4 py-2.5">
                      <Link href={`/munkavallalok/${employee.id}`} className="block truncate font-medium hover:text-rose-bright">
                        {employee.name}
                      </Link>
                      {employee.status !== "aktiv" && (
                        <span className="mt-0.5 block">
                          <Pill tone={EMPLOYEE_STATUS_TONE[employee.status]}>{EMPLOYEE_STATUS_SHORT[employee.status]}</Pill>
                        </span>
                      )}
                    </td>
                    <td className="truncate px-3 py-2.5 text-white/75">{employee.position}</td>
                    <td className="truncate px-3 py-2.5 text-white/60">{employee.department ?? "–"}</td>
                    <td className="hidden truncate px-3 py-2.5 text-white/60 xl:table-cell">{EMPLOYMENT_TYPES[employee.employmentType]}</td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-white/60 lg:table-cell">{formatDate(employee.startDate)}</td>
                    <td className="px-3 py-2.5">
                      <NearestExpiry employee={employee} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {list.map((employee) => (
              <li key={employee.id}>
                <Link href={`/munkavallalok/${employee.id}`} className="pg-card block rounded-2xl p-4 transition hover:bg-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold">{employee.name}</p>
                    {employee.status !== "aktiv" && <Pill tone={EMPLOYEE_STATUS_TONE[employee.status]}>{EMPLOYEE_STATUS_SHORT[employee.status]}</Pill>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-white/60">{[employee.position, employee.department].filter(Boolean).join(" · ")}</p>
                  <p className="mt-0.5 truncate text-xs text-white/40">
                    {EMPLOYMENT_TYPES[employee.employmentType]}
                    {employee.startDate && ` · belépés: ${formatDate(employee.startDate)}`}
                  </p>
                  <div className="mt-2">
                    <NearestExpiry employee={employee} today={today} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NearestExpiry({ employee, today }: { employee: Employee; today: string }) {
  const [first] = expiriesOf(employee, today);
  if (!first) return <span className="text-xs text-white/30">–</span>;
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5" title={`${first.label}: ${formatDate(first.date)}`}>
      <Pill tone={expiryTone(first.daysLeft)}>{expiryText(first.daysLeft)}</Pill>
      <span className="max-w-full truncate text-xs text-white/40">{first.label}</span>
    </span>
  );
}

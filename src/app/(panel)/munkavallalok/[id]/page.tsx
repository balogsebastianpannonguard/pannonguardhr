import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  ArrowLeft,
  CircleAlert,
  DatabaseZap,
  FileWarning,
  FileText,
  GraduationCap,
  UserRoundCheck,
  Award,
  BriefcaseBusiness,
  CircleCheck,
  Clock,
  HeartPulse,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Phone,
  ShieldAlert,
  TimerReset,
  UserRound,
} from "lucide-react";
import { AppsheetRecord } from "@/components/appsheet-record";
import { EmployeeDeleteForm, EmployeeExitForm } from "@/components/employee-actions";
import { ExpiryList } from "@/components/employee-expiry-list";
import { EmployeeQualifications } from "@/components/employee-qualifications";
import { EmployeeSecretPanel } from "@/components/employee-secret";
import { PageTitle } from "@/components/page-title";
import { Panel, Pill, Skeleton, buttonClass } from "@/components/ui";
import { dayKey, formatStamp } from "@/lib/dates";
import {
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_TONE,
  EMPLOYMENT_TYPES,
  EXIT_REASONS,
  expiriesOf,
  expiryText,
  expiryTone,
  formatDate,
  getEmployeeView,
} from "@/lib/employees";
import { recentChanges } from "@/lib/hr-log";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Munkatárs" };

export default function EmployeePage({ params, searchParams }: PageProps<"/munkavallalok/[id]">) {
  return (
    <div className="space-y-8">
      <Link href="/munkavallalok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Munkatársak
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  "employee.create": "Felvéve",
  "employee.update": "Adatok módosítva",
  "employee.import": "Importálva",
  "employee.appsheet.view": "AppSheet-adatlap bizalmas adatai megtekintve",
  "employee.exit": "Kilépés",
  "employee.secret.view": "Bizalmas adatok megtekintése",
  "employee.secret.update": "Bizalmas adatok módosítása",
  "employee.qualification.create": "Új végzettség / képesítés",
  "employee.qualification.update": "Végzettség / képesítés módosítva",
  "employee.qualification.delete": "Végzettség / képesítés törölve",
};

async function Detail({ params, searchParams }: Pick<PageProps<"/munkavallalok/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams, requireUser()]);
  const view = await getEmployeeView(id);
  if (!view) notFound();
  const { employee, hasSecret } = view;
  const changes = await recentChanges({ entity: "employee", entityId: employee.id }, 30);
  const today = dayKey(new Date());
  const expiries = expiriesOf(employee, today);
  const exited = employee.status === "kilepett";
  const missingDocs = employee.appsheet?.plain.hianyzoDokumentumok?.trim();
  const notice = query.uj === "1" ? "A munkavállalót felvettem." : query.mentve === "1" ? "A változásokat mentettem." : undefined;

  const dated = (date?: string, watch = true) => {
    if (!date) return undefined;
    if (!watch || exited) return formatDate(date);
    const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {formatDate(date)} <Pill tone={expiryTone(days)}>{expiryText(days)}</Pill>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {notice && (
        <p className="pg-rise flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100">
          <CircleCheck size={16} aria-hidden /> {notice}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow={[employee.company, employee.position, employee.department].filter(Boolean).join(" · ")} title={employee.name}>
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={EMPLOYEE_STATUS_TONE[employee.status]}>{EMPLOYEE_STATUS[employee.status]}</Pill>
            <Pill tone="muted">{EMPLOYMENT_TYPES[employee.employmentType]}</Pill>
            {employee.email && (
              <a href={`mailto:${employee.email}`} className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
                <Mail size={14} aria-hidden /> {employee.email}
              </a>
            )}
            {employee.phone && (
              <a href={`tel:${employee.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white">
                <Phone size={14} aria-hidden /> {employee.phone}
              </a>
            )}
          </span>
        </PageTitle>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dokumentumok?dolgozo=${employee.id}`} className={buttonClass("ghost", "sm")}>
            <FileText size={15} aria-hidden /> Dokumentumok
          </Link>
          <Link href={`/be-kilepes?dolgozo=${employee.id}`} className={buttonClass("ghost", "sm")}>
            <UserRoundCheck size={15} aria-hidden /> Be- és kilépés
          </Link>
          <Link href={`/kepzesek/dolgozo/${employee.id}`} className={buttonClass("ghost", "sm")}>
            <GraduationCap size={15} aria-hidden /> Képzések
          </Link>
          <Link href={`/munkavallalok/${employee.id}/szerkesztes`} className={buttonClass("secondary", "sm")}>
            <Pencil size={15} aria-hidden /> Szerkesztés
          </Link>
        </div>
      </div>

      {(missingDocs || (employee.appsheet?.issues.length ?? 0) > 0 || employee.appsheet?.missing) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {missingDocs && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/8 p-4 text-sm text-amber-100">
              <FileWarning size={18} aria-hidden className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Hiányzó dokumentumok</p>
                <p className="mt-0.5 whitespace-pre-wrap text-amber-100/85">{missingDocs}</p>
              </div>
            </div>
          )}
          {(employee.appsheet?.issues.length ?? 0) > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/8 p-4 text-sm text-red-100">
              <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Ellenőrizendő az AppSheet-ben</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-red-100/85">
                  {employee.appsheet!.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-red-100/60">Az adatot nem módosítottam – pontosan úgy szerepel, ahogy az exportban volt.</p>
              </div>
            </div>
          )}
          {employee.appsheet?.missing && (
            <p className="rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/65">
              Ez a munkatárs a legutóbbi AppSheet-exportban már nem szerepelt. Ha kilépett, rögzítsd a kilépését.
            </p>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Alapadatok" icon={UserRound}>
            <Facts
              rows={[
                ["Név", employee.name],
                ["Cég", employee.company],
                ["E-mail", employee.email],
                ["Telefon", employee.phone],
                ["Munkakör", employee.position],
                ["Egység / objektum", employee.department],
                ["Közvetlen vezető", employee.manager],
              ]}
            />
          </Panel>

          <Panel title="Munkaviszony" icon={BriefcaseBusiness}>
            <Facts
              rows={[
                ["Állapot", EMPLOYEE_STATUS[employee.status]],
                ["Jogviszony", EMPLOYMENT_TYPES[employee.employmentType]],
                ["Belépés napja", dated(employee.startDate, false)],
                ["Próbaidő vége", dated(employee.probationEnd)],
                ["Határozott idő vége", dated(employee.contractEnd)],
                ["Heti óraszám", employee.weeklyHours ? `${employee.weeklyHours} óra` : undefined],
                ["Iskolai végzettség", employee.education],
                ...(exited
                  ? ([
                      ["Kilépés napja", dated(employee.exitDate, false)],
                      ["Kilépés oka", employee.exitReason && EXIT_REASONS[employee.exitReason]],
                    ] as [string, ReactNode][])
                  : []),
              ]}
            />
            {employee.notes && <p className="mt-4 rounded-xl bg-white/3 p-3 text-sm whitespace-pre-wrap text-white/65">{employee.notes}</p>}
          </Panel>

          <Panel title="Orvosi alkalmasság és vagyonőri igazolvány" icon={HeartPulse}>
            <Facts
              rows={[
                ["Foglalkozás-egészségügyi alkalmasság", dated(employee.medicalExpiry) ?? <span className="text-amber-200/80">Nincs rögzítve</span>],
                ["Vagyonőri igazolvány száma", employee.guardLicenseNumber],
                ["Vagyonőri igazolvány lejárata", dated(employee.guardLicenseExpiry)],
              ]}
            />
          </Panel>

          <Panel title="Végzettségek, képesítések, jogosultságok" icon={Award}>
            <EmployeeQualifications employeeId={employee.id} items={employee.qualifications} today={today} exited={exited} />
          </Panel>

          <Panel title="Bér és személyes adatok" icon={LockKeyhole}>
            <EmployeeSecretPanel employeeId={employee.id} hasSecret={hasSecret} />
          </Panel>

          {employee.appsheet && (
            <Panel title="AppSheet-adatlap – minden adat, eredeti formában" icon={DatabaseZap}>
              <AppsheetRecord employeeId={employee.id} record={employee.appsheet} />
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Lejáratok" icon={TimerReset}>
            <ExpiryList items={expiries} showEmployee={false} empty={exited ? "Kilépett dolgozónál nem figyeljük a lejáratokat." : "Nincs rögzített lejárati dátum."} />
          </Panel>

          {!exited && (
            <Panel title="Kilépés rögzítése" icon={LogOut}>
              <EmployeeExitForm employeeId={employee.id} today={today} />
            </Panel>
          )}

          <Panel title="Változásnapló" icon={Clock}>
            {changes.length === 0 ? (
              <p className="text-sm text-white/55">Még nincs bejegyzés.</p>
            ) : (
              <ol className="space-y-3">
                {changes.map((entry, index) => (
                  <li key={`${entry.at.toISOString()}-${index}`} className="text-sm">
                    <p className="font-medium">{ACTIONS[entry.action] ?? entry.action}</p>
                    {entry.summary && entry.summary !== ACTIONS[entry.action] && <p className="text-xs text-white/55">{entry.summary}</p>}
                    <p className="text-xs text-white/40">
                      {entry.byName} · {formatStamp(entry.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs text-white/35">
              Felvéve: {formatStamp(employee.createdAt)} · utolsó módosítás: {formatStamp(employee.updatedAt)}
            </p>
          </Panel>

          <Panel title="Adattörlés (GDPR)" icon={ShieldAlert}>
            <p className="mb-3 text-sm text-white/55">
              Ha a megőrzési idő letelt, vagy a dolgozó kéri az adatai törlését, itt véglegesen eltávolíthatod.
            </p>
            <EmployeeDeleteForm employeeId={employee.id} name={employee.name} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-white/45">{label}</dt>
          <dd className="font-medium [overflow-wrap:anywhere]">{value || <span className="text-white/30">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

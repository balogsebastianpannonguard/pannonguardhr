import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CircleCheck, ClipboardList, FileText, ListChecks, LogIn, LogOut, Play, UserRound, X } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { ProcessCreateForm } from "@/components/process-create-form";
import { ProcessProgress } from "@/components/process-progress";
import { Empty, LinkButton, Panel, Pill, Skeleton, Stat } from "@/components/ui";
import { dayKey } from "@/lib/dates";
import { EXIT_REASONS, employeeOptions, parseId } from "@/lib/employees";
import {
  PROCESS_KINDS,
  PROCESS_STATUS,
  REFERENCE_LABEL,
  formatDate,
  getChecklist,
  isProcessOverdue,
  listProcesses,
  overdueSteps,
  progressOf,
  type Process,
} from "@/lib/processes";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Belépés és kilépés" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function OnboardingPage({ searchParams }: PageProps<"/be-kilepes">) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Munkaügy" title="Belépés és" accent="kilépés.">
          Minden be- és kilépésnek saját ellenőrzőlistája van határidőkkel, így semmi nem marad ki – a NAV-bejelentéstől az egyenruha visszavételéig.
        </PageTitle>
        <LinkButton href="/be-kilepes/sablonok" variant="secondary" size="sm">
          <ListChecks size={15} aria-hidden /> Ellenőrzőlisták
        </LinkButton>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Onboarding({ searchParams }: Pick<PageProps<"/be-kilepes">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const employeeParam = one(params.dolgozo);
  const employeeId = parseId(employeeParam);
  const view = ["lezart", "osszes"].includes(one(params.allapot)) ? one(params.allapot) : "nyitott";
  const kindParam = one(params.tipus);
  const defaultKind = kindParam === "kilepes" ? "kilepes" : "belepes";

  const [all, options, belepes, kilepes] = await Promise.all([
    listProcesses(employeeId ? { employeeId } : {}),
    employeeOptions(true),
    getChecklist("belepes"),
    getChecklist("kilepes"),
  ]);
  const today = dayKey(new Date());
  const selected = employeeId ? options.find((option) => option.id === employeeParam) : undefined;
  const open = all.filter((process) => process.status === "nyitott");
  const rows = view === "osszes" ? all : view === "lezart" ? all.filter((process) => process.status !== "nyitott") : open;
  const overdueCount = open.reduce((sum, process) => sum + overdueSteps(process, today).length, 0);
  const choices = options
    .filter((option) => option.status !== "kilepett" || option.id === employeeParam)
    .map(({ id, name, position, status }) => ({ id, name, position, status }));
  const exited = options.filter((option) => option.status === "kilepett" && option.id !== employeeParam);

  const tab = (value: string, label: string) => {
    const query = new URLSearchParams({ ...(employeeId && { dolgozo: employeeParam }), ...(value !== "nyitott" && { allapot: value }) }).toString();
    return (
      <Link
        key={value}
        href={`/be-kilepes${query ? `?${query}` : ""}`}
        aria-current={view === value ? "page" : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === value ? "bg-rose/15 text-rose-bright" : "text-white/55 hover:bg-white/6 hover:text-white"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {selected && (
        <div className="pg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <p className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-rose/15 text-rose">
              <UserRound size={17} aria-hidden />
            </span>
            <span>
              <span className="font-semibold">{selected.name}</span>
              <span className="block text-sm text-white/50">{selected.position}</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/munkavallalok/${selected.id}`} variant="ghost" size="sm">
              Adatlap
            </LinkButton>
            <LinkButton href={`/dokumentumok?dolgozo=${selected.id}`} variant="secondary" size="sm">
              <FileText size={14} aria-hidden /> Dokumentumai
            </LinkButton>
            <LinkButton href="/be-kilepes" variant="ghost" size="sm">
              <X size={14} aria-hidden /> Szűrés törlése
            </LinkButton>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Folyamatban lévő belépés" value={open.filter((process) => process.kind === "belepes").length} icon={LogIn} tone="text-rose-bright" />
        <Stat label="Folyamatban lévő kilépés" value={open.filter((process) => process.kind === "kilepes").length} icon={LogOut} tone="text-pink-bright" />
        <Stat label="Lejárt határidejű lépés" value={overdueCount} icon={CalendarClock} tone={overdueCount ? "text-red-300" : "text-white"} />
        <Stat label="Lezárt folyamat" value={all.filter((process) => process.status === "lezart").length} icon={CircleCheck} tone="text-emerald-300" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Folyamatok" icon={ClipboardList} action={<nav className="flex flex-wrap gap-1">{[tab("nyitott", "Folyamatban"), tab("lezart", "Lezárt"), tab("osszes", "Összes")]}</nav>}>
          {rows.length === 0 ? (
            <Empty
              icon={ClipboardList}
              title={view === "nyitott" ? "Nincs folyamatban lévő be- vagy kilépés" : "Nincs megjeleníthető folyamat"}
              text={view === "nyitott" ? "Új belépőnél vagy távozó kollégánál indíts folyamatot az űrlappal – a lépéseket a rendszer határidővel együtt felveszi." : undefined}
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((process) => (
                <ProcessRow key={process.id} process={process} today={today} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Új folyamat" icon={Play} className="lg:sticky lg:top-6">
          <ProcessCreateForm
            employees={choices}
            selectedId={selected?.id}
            defaultKind={selected?.status === "kilepett" ? "kilepes" : defaultKind}
            defaultResponsible={user.name}
            today={today}
            exitReasons={EXIT_REASONS}
            stepCounts={{ belepes: belepes.steps.length, kilepes: kilepes.steps.length }}
          />
          {choices.length === 0 && <p className="mt-3 text-sm text-amber-200">Még nincs munkavállaló a nyilvántartásban – előbb vedd fel a Munkavállalók menüben.</p>}
          {exited.length > 0 && <p className="mt-3 text-xs text-white/35">A kilépett dolgozók nem szerepelnek a listában; az adatlapjukról nyitva (?dolgozo=) mégis indítható folyamat.</p>}
        </Panel>
      </div>
    </div>
  );
}

function ProcessRow({ process, today }: { process: Process; today: string }) {
  const progress = progressOf(process);
  const late = overdueSteps(process, today);
  const overdue = isProcessOverdue(process, today);
  const next = process.steps.find((step) => !step.done && !step.optional);
  return (
    <li>
      <Link href={`/be-kilepes/${process.id}`} className="pg-card block rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <Pill tone={process.kind === "belepes" ? "info" : "muted"} icon={process.kind === "belepes" ? LogIn : LogOut}>
                {PROCESS_KINDS[process.kind]}
              </Pill>
              <span className="font-semibold [overflow-wrap:anywhere]">{process.employeeName}</span>
            </p>
            <p className="mt-1 text-sm text-white/50">
              {process.position && `${process.position} · `}
              {REFERENCE_LABEL[process.kind]}: {formatDate(process.referenceDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {process.status !== "nyitott" && <Pill tone={process.status === "lezart" ? "ok" : "muted"}>{PROCESS_STATUS[process.status]}</Pill>}
            {late.length > 0 && <Pill tone="error">{late.length} lejárt lépés</Pill>}
            {overdue && <Pill tone="warning">határidőn túl</Pill>}
          </div>
        </div>
        <div className="mt-3">
          <ProcessProgress {...progress} overdue={late.length > 0} />
        </div>
        <p className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-white/45">
          <span className="min-w-0 truncate">{process.status === "nyitott" && next ? `Következő: ${next.title}` : progress.allDone ? "Minden kötelező lépés kész" : ""}</span>
          <span>
            {process.responsible && `${process.responsible} · `}
            határidő: {formatDate(process.dueDate)}
          </span>
        </p>
      </Link>
    </li>
  );
}

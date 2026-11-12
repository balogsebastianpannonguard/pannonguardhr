import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, FileText, ListChecks, LogIn, LogOut, Settings2, UserRound } from "lucide-react";
import { ProcessProgress } from "@/components/process-progress";
import { ProcessSettings } from "@/components/process-settings";
import { ProcessSteps } from "@/components/process-steps";
import { LinkButton, Panel, Pill, Skeleton } from "@/components/ui";
import { dayKey, formatStamp } from "@/lib/dates";
import { parseId } from "@/lib/employees";
import { PROCESS_KINDS, PROCESS_STATUS, REFERENCE_LABEL, formatDate, getProcess, isProcessOverdue, isStepOverdue, progressOf } from "@/lib/processes";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Belépés és kilépés" };

export default function ProcessPage({ params }: PageProps<"/be-kilepes/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/be-kilepes" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Belépés és kilépés
      </Link>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <ProcessDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ProcessDetail({ params }: Pick<PageProps<"/be-kilepes/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const _id = parseId(id);
  const process = _id ? await getProcess(_id) : null;
  if (!process) notFound();

  const today = dayKey(new Date());
  const progress = progressOf(process);
  const open = process.status === "nyitott";
  const lateCount = open ? process.steps.filter((step) => isStepOverdue(step, today)).length : 0;
  const steps = process.steps.map((step) => ({
    id: step.id,
    title: step.title,
    hint: step.hint,
    optional: step.optional,
    dueDate: step.dueDate,
    dueLabel: step.dueDate ? `határidő: ${formatDate(step.dueDate)}` : undefined,
    done: step.done,
    doneLabel: step.done ? [step.doneBy, step.doneAt && formatStamp(step.doneAt)].filter(Boolean).join(" · ") || "kész" : undefined,
    comment: step.comment,
    commentLabel: step.comment ? [step.commentBy, step.commentAt && formatStamp(step.commentAt)].filter(Boolean).join(" · ") : undefined,
    overdue: open && isStepOverdue(step, today),
  }));
  const Icon = process.kind === "belepes" ? LogIn : LogOut;

  return (
    <div className="space-y-6">
      <header className="pg-rise flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-rose uppercase">
            <Icon size={14} aria-hidden /> {PROCESS_KINDS[process.kind]}i folyamat
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{process.employeeName}</h1>
          <p className="mt-1 text-white/55">
            {process.position && `${process.position} · `}
            {REFERENCE_LABEL[process.kind]}: <strong className="text-white/80">{formatDate(process.referenceDate)}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone={process.status === "lezart" ? "ok" : process.status === "nyitott" ? "info" : "muted"}>{PROCESS_STATUS[process.status]}</Pill>
            {lateCount > 0 && <Pill tone="error">{lateCount} lejárt lépés</Pill>}
            {isProcessOverdue(process, today) && <Pill tone="warning">a lezárás határideje lejárt</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/munkavallalok/${process.employeeId}`} variant="ghost" size="sm">
            <UserRound size={14} aria-hidden /> Adatlap
          </LinkButton>
          <LinkButton href={`/dokumentumok?dolgozo=${process.employeeId}`} variant="secondary" size="sm">
            <FileText size={14} aria-hidden /> Dokumentum készítése
          </LinkButton>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Panel title="Lépések" icon={ListChecks}>
          <div className="mb-5">
            <ProcessProgress {...progress} overdue={lateCount > 0} />
            <p className="mt-1.5 text-xs text-white/40">
              {progress.percent}% kész · az opcionális lépések nem számítanak bele
            </p>
          </div>
          <ProcessSteps processId={process.id} steps={steps} open={open} allDone={progress.allDone} />
        </Panel>

        <Panel title="Adatok" icon={Settings2} className="lg:sticky lg:top-6">
          <ProcessSettings
            process={{ id: process.id, status: process.status, dueDate: process.dueDate, responsible: process.responsible, note: process.note, referenceDate: process.referenceDate }}
            statuses={PROCESS_STATUS}
            referenceLabel={REFERENCE_LABEL[process.kind]}
          />
          <p className="mt-5 border-t border-white/8 pt-4 text-xs leading-relaxed text-white/35">
            Indította: {process.createdBy}, {formatStamp(process.createdAt)}
            <br />
            Utoljára módosította: {process.updatedBy}, {formatStamp(process.updatedAt)}
            {process.closedAt && (
              <>
                <br />
                Lezárva: {formatStamp(process.closedAt)}
              </>
            )}
          </p>
        </Panel>
      </div>
    </div>
  );
}

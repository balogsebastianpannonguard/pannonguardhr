import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ListChecks } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { ProcessChecklistEditor } from "@/components/process-checklist-editor";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { formatStamp } from "@/lib/dates";
import { DEFAULT_STEPS, PROCESS_KINDS, REFERENCE_LABEL, getChecklist, type ProcessKind } from "@/lib/processes";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ellenőrzőlisták" };

export default function ChecklistPage({ searchParams }: PageProps<"/be-kilepes/sablonok">) {
  return (
    <div className="space-y-8">
      <Link href="/be-kilepes" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Belépés és kilépés
      </Link>
      <PageTitle eyebrow="Munkaügy · Sablonok" title="Ellenőrzőlisták" accent="szerkesztése.">
        Itt állíthatod be, milyen lépésekkel induljon egy új belépési vagy kilépési folyamat. Az alaplistát a hazai gyakorlat és a vagyonvédelmi előírások alapján
        állítottuk össze.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Checklists searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checklists({ searchParams }: Pick<PageProps<"/be-kilepes/sablonok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const kind: ProcessKind = params.tipus === "kilepes" ? "kilepes" : "belepes";
  const checklist = await getChecklist(kind);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        {(Object.keys(PROCESS_KINDS) as ProcessKind[]).map((value) => (
          <Link
            key={value}
            href={`/be-kilepes/sablonok${value === "kilepes" ? "?tipus=kilepes" : ""}`}
            aria-current={kind === value ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${kind === value ? "bg-rose/15 text-rose-bright ring-1 ring-rose/40" : "bg-white/4 text-white/60 hover:bg-white/8"}`}
          >
            {PROCESS_KINDS[value]}
          </Link>
        ))}
      </nav>
      <Panel
        title={`${PROCESS_KINDS[kind]}i ellenőrzőlista`}
        icon={ListChecks}
        action={checklist.custom ? <Pill tone="info">Módosított · {checklist.updatedBy}, {formatStamp(checklist.updatedAt)}</Pill> : <Pill>Alapértelmezett</Pill>}
      >
        <ProcessChecklistEditor key={kind} kind={kind} steps={checklist.steps} defaults={DEFAULT_STEPS[kind]} custom={checklist.custom} referenceLabel={REFERENCE_LABEL[kind]} />
      </Panel>
    </div>
  );
}

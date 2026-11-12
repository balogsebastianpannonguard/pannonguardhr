import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { HrDocLegalNote } from "@/components/hrdoc-legal-note";
import { HrDocTemplateEditor } from "@/components/hrdoc-template-editor";
import { PageTitle } from "@/components/page-title";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { formatStamp } from "@/lib/dates";
import { STANDARD_FIELDS, TEMPLATE_GROUPS, listTemplates, standardValues } from "@/lib/hr-documents";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dokumentumsablonok" };
export const maxDuration = 120;

export default function TemplatesPage({ searchParams }: PageProps<"/dokumentumok/sablonok">) {
  return (
    <div className="space-y-8">
      <Link href="/dokumentumok" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> HR-dokumentumok
      </Link>
      <PageTitle eyebrow="Munkaügy · Sablonok" title="Dokumentumsablonok" accent="szerkesztése.">
        A sablonok szövegét a cégre szabhatod; a módosítás csak az ezután készülő dokumentumokra hat. Bármikor visszaállíthatod az eredeti szöveget.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Templates searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Templates({ searchParams }: Pick<PageProps<"/dokumentumok/sablonok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const templates = await listTemplates();
  const key = Array.isArray(params.sablon) ? params.sablon[0] : params.sablon;
  const current = templates.find((template) => template.key === key) ?? templates[0];
  // Minta-előnézet munkavállaló nélkül: csak a munkáltató adatai és a dátum töltődik ki.
  const sampleValues = standardValues(null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="Sablonok" className="space-y-4 lg:sticky lg:top-6">
        {(Object.entries(TEMPLATE_GROUPS) as [keyof typeof TEMPLATE_GROUPS, string][]).map(([group, label]) => (
          <div key={group}>
            <p className="mb-1.5 px-2 text-xs font-semibold tracking-[0.18em] text-white/40 uppercase">{label}</p>
            <ul className="space-y-1">
              {templates
                .filter((template) => template.group === group)
                .map((template) => (
                  <li key={template.key}>
                    <Link
                      href={`/dokumentumok/sablonok?sablon=${template.key}`}
                      aria-current={template.key === current.key ? "page" : undefined}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ${
                        template.key === current.key ? "bg-rose/15 font-semibold text-rose-bright" : "text-white/65 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      <span className="min-w-0">{template.title}</span>
                      {template.custom && <span className="size-1.5 shrink-0 rounded-full bg-pink-bright" title="Módosított" />}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        <HrDocLegalNote />
        <Panel
          title={current.title}
          icon={FileText}
          action={current.custom ? <Pill tone="info">Módosított · {current.updatedBy}, {formatStamp(current.updatedAt)}</Pill> : <Pill>Alapértelmezett</Pill>}
        >
          <p className="mb-4 text-sm text-white/55">{current.description}</p>
          <HrDocTemplateEditor
            key={current.key}
            templateKey={current.key}
            title={current.title}
            body={current.body}
            custom={current.custom}
            standard={STANDARD_FIELDS.map(({ key: fieldKey, label }) => ({ key: fieldKey, label }))}
            fields={current.fields}
            sampleValues={sampleValues}
            signatures={current.signatures}
            aiEnabled={aiAvailable()}
          />
        </Panel>
      </div>
    </div>
  );
}

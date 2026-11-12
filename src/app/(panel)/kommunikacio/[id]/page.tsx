import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ListChecks } from "lucide-react";
import { CommsEditor } from "@/components/comms-editor";
import { PageTitle } from "@/components/page-title";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { DOC_TYPES, LENGTHS, TONES, getDraft } from "@/lib/comms";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Vázlat" };
export const maxDuration = 120;

export default function DraftPage({ params }: PageProps<"/kommunikacio/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/kommunikacio" className="print-hidden inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Kommunikáció
      </Link>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Draft params={params} />
      </Suspense>
    </div>
  );
}

async function Draft({ params }: Pick<PageProps<"/kommunikacio/[id]">, "params">) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const draft = await getDraft(user.id, id);
  if (!draft) notFound();

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageTitle eyebrow={`${DOC_TYPES[draft.type]} · ${TONES[draft.tone]}`} title={draft.title} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <CommsEditor
            // Másik vázlatra lépve a szerkesztő friss állapottal indul.
            key={draft.id}
            id={draft.id}
            initialTitle={draft.title}
            initialBody={draft.body}
            hasPrevious={Boolean(draft.previous)}
            aiOn={aiAvailable()}
            meta={`utoljára módosítva: ${formatStamp(draft.updatedAt)}`}
          />
        </div>
        <Panel title="A megadott szempontok" icon={ListChecks} className="min-w-0 print:hidden">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-white/45">Kinek szól</dt>
              <dd>{draft.brief.audience}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="info">{DOC_TYPES[draft.type]}</Pill>
              <Pill tone="muted">{TONES[draft.tone]}</Pill>
              <Pill tone="muted">{LENGTHS[draft.brief.length]}</Pill>
            </div>
            {draft.brief.subject && (
              <div>
                <dt className="text-xs text-white/45">Tárgy / téma</dt>
                <dd className="[overflow-wrap:anywhere]">{draft.brief.subject}</dd>
              </div>
            )}
            {draft.brief.points && (
              <div>
                <dt className="text-xs text-white/45">Kulcspontok</dt>
                <dd className="whitespace-pre-wrap text-white/70 [overflow-wrap:anywhere]">{draft.brief.points}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-white/45">Létrehozva</dt>
              <dd>{formatStamp(draft.createdAt)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

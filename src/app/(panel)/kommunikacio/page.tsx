import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, PenLine } from "lucide-react";
import { CommsDraftActions } from "@/components/comms-draft-actions";
import { CommsForm } from "@/components/comms-form";
import { AiNote, NoAiBanner } from "@/components/legal-note";
import { PageTitle } from "@/components/page-title";
import { Empty, Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { AUDIENCES, DOC_TYPES, LENGTHS, TEMPLATES, TONES, listDrafts } from "@/lib/comms";
import { formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Kommunikáció" };
export const maxDuration = 120;

export default function CommsPage() {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Kommunikáció" title="HR-szövegek" accent="percek alatt.">
        E-mail, tájékoztató, közlemény, munkaköri leírás vagy álláshirdetés: add meg a lényeget, a vázlatot pedig szerkesztheted,
        finomíthatod, kimásolhatod vagy kinyomtathatod.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Comms />
      </Suspense>
    </div>
  );
}

async function Comms() {
  const user = await requireUser();
  const list = await listDrafts(user.id);
  const aiOn = aiAvailable();

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {!aiOn && <NoAiBanner what="A szövegírás" />}
        <Panel title="Új vázlat" icon={PenLine}>
          <CommsForm
            aiOn={aiOn}
            types={DOC_TYPES}
            tones={TONES}
            lengths={LENGTHS}
            audiences={AUDIENCES}
            templates={TEMPLATES}
            defaultSignature={`${user.name}\nHR-vezető\nPannonGuard Biztonsági Szolgáltató Zrt.`}
          />
          <AiNote className="mt-4" />
        </Panel>
      </div>

      <Panel title="Mentett vázlatok" icon={FileText}>
        {list.length === 0 ? (
          <Empty icon={FileText} title="Még nincs vázlat" text="Az elkészült szövegek titkosítva ide kerülnek, bármikor újranyithatod őket." />
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {list.map((draft) => (
              <li key={draft.id} className="flex items-center gap-1 rounded-xl px-2 transition hover:bg-white/5">
                <Link href={`/kommunikacio/${draft.id}`} className="min-w-0 flex-1 py-2.5">
                  <p className="truncate text-sm font-medium">{draft.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-white/45">
                    <span>{DOC_TYPES[draft.type]}</span>
                    <span>{formatStamp(draft.updatedAt)}</span>
                  </p>
                </Link>
                <CommsDraftActions id={draft.id} compact />
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <p className="mt-3 text-xs text-white/40">
            <Pill tone="muted">{list.length}</Pill> legutóbbi vázlat, a legfrissebb elöl.
          </p>
        )}
      </Panel>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { FileSearch } from "lucide-react";
import { LegalReviewForm } from "@/components/legal-forms";
import { LegalHistory } from "@/components/legal-history";
import { AiNote, LegalTabs, NoAiBanner, PrivacyHint } from "@/components/legal-note";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { listLegal } from "@/lib/legal-hr";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Irat ellenőrzése" };
export const maxDuration = 120;

export default function ReviewPage({ searchParams }: PageProps<"/jog/ellenorzes">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Jog és szabályzat" title="Szabályzat és irat" accent="ellenőrzése.">
        Illeszd be vagy töltsd fel a szabályzatot, szerződésmintát, tájékoztatót: megkapod a kockázatokat súlyosság szerint, a
        hiányzó kötelező elemeket és a javasolt megfogalmazást.
      </PageTitle>
      <LegalTabs active="/jog/ellenorzes" />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Review searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Review({ searchParams }: Pick<PageProps<"/jog/ellenorzes">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const rows = await listLegal(user.id, { query, kind: "ellenorzes" });
  const aiOn = aiAvailable();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {!aiOn && <NoAiBanner what="Az irat-ellenőrzés" />}
        <Panel title="Ellenőrizendő irat" icon={FileSearch}>
          <LegalReviewForm aiOn={aiOn} />
          <div className="mt-4 space-y-2">
            <PrivacyHint />
            <AiNote />
          </div>
        </Panel>
      </div>
      <LegalHistory rows={rows} query={query} path="/jog/ellenorzes" />
    </div>
  );
}

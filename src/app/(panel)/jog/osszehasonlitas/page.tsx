import type { Metadata } from "next";
import { Suspense } from "react";
import { GitCompareArrows } from "lucide-react";
import { LegalCompareForm } from "@/components/legal-forms";
import { LegalHistory } from "@/components/legal-history";
import { AiNote, LegalTabs, NoAiBanner, PrivacyHint } from "@/components/legal-note";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { listLegal } from "@/lib/legal-hr";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Összehasonlítás" };
export const maxDuration = 120;

export default function ComparePage({ searchParams }: PageProps<"/jog/osszehasonlitas">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Jog és szabályzat" title="Két változat" accent="összevetése.">
        Add meg egy szabályzat vagy szerződésminta régi és új változatát: bekezdésenként látod, mi került bele és mi esett ki, az AI
        pedig összefoglalja az érdemi változásokat és azok munkajogi hatását.
      </PageTitle>
      <LegalTabs active="/jog/osszehasonlitas" />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Compare searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Compare({ searchParams }: Pick<PageProps<"/jog/osszehasonlitas">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const rows = await listLegal(user.id, { query, kind: "osszehasonlitas" });
  const aiOn = aiAvailable();

  return (
    <div className="space-y-6">
      {!aiOn && <NoAiBanner what="Az összehasonlítás összefoglalója" />}
      <Panel title="Változatok" icon={GitCompareArrows}>
        <LegalCompareForm aiOn={aiOn} />
        <div className="mt-4 space-y-2">
          <PrivacyHint />
          <AiNote />
        </div>
      </Panel>
      <LegalHistory rows={rows} query={query} path="/jog/osszehasonlitas" />
    </div>
  );
}

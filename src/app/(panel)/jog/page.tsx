import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageCircleQuestionMark } from "lucide-react";
import { LegalQuestionForm } from "@/components/legal-forms";
import { LegalHistory, UsefulLaws } from "@/components/legal-history";
import { AiNote, LegalTabs, NoAiBanner, PrivacyHint } from "@/components/legal-note";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { EXAMPLE_QUESTIONS, listLegal } from "@/lib/legal-hr";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Jog és szabályzat" };
export const maxDuration = 120;

export default function LegalPage({ searchParams }: PageProps<"/jog">) {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Jog és szabályzat" title="Munkajogi" accent="támogatás.">
        Kérdezz bátran a munkaidőről, szabadságról, felmondásról – vagy ellenőriztesd és hasonlítsd össze a szabályzatokat. A
        válaszok a Munka Törvénykönyvére, a vagyonőri törvényre és az adatvédelmi szabályokra épülnek.
      </PageTitle>
      <LegalTabs active="/jog" />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Legal searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Legal({ searchParams }: Pick<PageProps<"/jog">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const rows = await listLegal(user.id, { query });
  const aiOn = aiAvailable();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {!aiOn && <NoAiBanner what="A munkajogi támogatás" />}
        <Panel title="Munkajogi kérdés" icon={MessageCircleQuestionMark}>
          <LegalQuestionForm aiOn={aiOn} examples={EXAMPLE_QUESTIONS} />
          <div className="mt-4 space-y-2">
            <PrivacyHint />
            <AiNote />
          </div>
        </Panel>
        <UsefulLaws />
      </div>
      <LegalHistory rows={rows} query={query} path="/jog" showKind />
    </div>
  );
}

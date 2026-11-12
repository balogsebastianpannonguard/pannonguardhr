import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Megaphone, Pencil, UserPlus, Users } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { AdEditor } from "@/components/recruitment-ad";
import { AddCandidate } from "@/components/recruitment-add";
import { Pipeline, type PipelineCard } from "@/components/recruitment-pipeline";
import { PositionForm } from "@/components/recruitment-position-form";
import { DeletePositionButton } from "@/components/recruitment-tools";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { dayKey, formatShortDate } from "@/lib/dates";
import { EMPLOYMENT_TYPES } from "@/lib/employees";
import { getPosition, guardLicenceOf, listCandidates } from "@/lib/recruitment";
import { POSITION_STATUS, POSITION_TONE } from "@/lib/recruitment-meta";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Álláshely" };
export const maxDuration = 120;

export default function PositionPage({ params }: PageProps<"/toborzas/[id]">) {
  return (
    <div className="space-y-8">
      <Link href="/toborzas" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Toborzás
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/toborzas/[id]">, "params">) {
  const [{ id }] = await Promise.all([params, requireUser()]);
  const position = await getPosition(id);
  if (!position) notFound();
  const candidates = await listCandidates(position.id);
  const today = dayKey(new Date());
  const aiOn = aiAvailable();

  const cards: PipelineCard[] = candidates.map((candidate) => {
    const next = candidate.interviews.find((item) => item.date >= today);
    return {
      id: candidate.id,
      name: candidate.name,
      stage: candidate.stage,
      location: candidate.location,
      rating: candidate.rating,
      fitScore: candidate.fit?.score,
      guardLicence: Boolean(guardLicenceOf(candidate)),
      nextInterview: next ? `${formatShortDate(next.date)} ${next.time}` : undefined,
      hired: Boolean(candidate.employeeId),
    };
  });

  return (
    <div className="space-y-6">
      <PageTitle eyebrow={`Álláshely · ${EMPLOYMENT_TYPES[position.employmentType]}`} title={position.title}>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={POSITION_TONE[position.status]}>{POSITION_STATUS[position.status]}</Pill>
          <span className="text-white/50">
            {[position.department, position.location, position.schedule, `${position.headcount} fő`].filter(Boolean).join(" · ")}
          </span>
        </span>
      </PageTitle>

      <Panel title={`Jelöltek (${candidates.length})`} icon={Users}>
        {candidates.length === 0 ? (
          <p className="text-sm text-white/55">Még nincs jelölt ehhez az álláshoz. Lent feltöltheted az önéletrajzokat.</p>
        ) : (
          <Pipeline positionId={position.id} cards={cards} />
        )}
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Jelölt felvétele" icon={UserPlus}>
          <AddCandidate positionId={position.id} aiOn={aiOn} />
        </Panel>
        <Panel title="Álláshirdetés" icon={Megaphone}>
          <AdEditor positionId={position.id} initialText={position.ad?.text} initialTone={position.ad?.tone} aiOn={aiOn} />
          <p className="mt-2 text-xs text-white/40">Az AI-szöveg vázlat: közzététel előtt mindig olvasd át, és ellenőrizd a béreket, juttatásokat.</p>
        </Panel>
      </div>

      <Panel title="Álláshely adatai" icon={Pencil}>
        <PositionForm position={position} employmentTypes={Object.entries(EMPLOYMENT_TYPES)} />
      </Panel>

      <div className="flex justify-end">
        <DeletePositionButton id={position.id} count={candidates.length} />
      </div>
    </div>
  );
}

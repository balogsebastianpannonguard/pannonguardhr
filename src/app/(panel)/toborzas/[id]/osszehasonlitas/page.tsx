import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ArrowLeft, GitCompareArrows, Sparkles, Star } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { CompareAi } from "@/components/recruitment-tools";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { getCandidate, getPosition, guardLicenceOf, type Candidate } from "@/lib/recruitment";
import { STAGES, STAGE_TONE } from "@/lib/recruitment-meta";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Jelöltek összehasonlítása" };
export const maxDuration = 120;

type Props = PageProps<"/toborzas/[id]/osszehasonlitas">;

export default function ComparePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <Compare params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const average = (candidate: Candidate) => {
  const scores = candidate.scorecard?.criteria.map((item) => item.score).filter((score): score is number => Boolean(score)) ?? [];
  return scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1).replace(".", ",") : undefined;
};

const ROWS: { label: string; render: (candidate: Candidate) => ReactNode }[] = [
  { label: "Szakasz", render: (c) => <Pill tone={STAGE_TONE[c.stage]}>{STAGES[c.stage]}</Pill> },
  {
    label: "Saját értékelés",
    render: (c) =>
      c.rating ? (
        <span className="flex items-center gap-1 text-amber-200">
          <Star size={13} aria-hidden className="fill-current" /> {c.rating}/5
        </span>
      ) : (
        "–"
      ),
  },
  { label: "Interjú-értékelés (átlag)", render: (c) => (average(c) ? `${average(c)} / 5` : "–") },
  { label: "AI illeszkedés (támogatás)", render: (c) => (c.fit ? `${c.fit.score}%` : "–") },
  { label: "Település", render: (c) => c.location ?? "–" },
  {
    label: "Vagyonőri igazolvány",
    render: (c) => {
      const licence = guardLicenceOf(c);
      return licence ? `Van${licence.expiresAt ? ` (érvényes: ${licence.expiresAt})` : ""}` : <span className="text-amber-200">Nincs megadva</span>;
    },
  },
  { label: "Jogosítvány", render: (c) => c.drivingLicence ?? "–" },
  {
    label: "Tapasztalat",
    render: (c) =>
      c.experience.length ? (
        <ul className="space-y-1">
          {c.experience.slice(0, 4).map((item, index) => (
            <li key={index}>
              {item.role}
              {item.employer && <span className="text-white/45"> · {item.employer}</span>}
              {item.period && <span className="block text-xs text-white/40">{item.period}</span>}
            </li>
          ))}
        </ul>
      ) : (
        "–"
      ),
  },
  { label: "Végzettség", render: (c) => (c.education.length ? c.education.join("; ") : "–") },
  { label: "Képesítések", render: (c) => (c.qualifications.length ? c.qualifications.map((item) => item.name).join("; ") : "–") },
  { label: "Nyelvek", render: (c) => (c.languages.length ? c.languages.join(", ") : "–") },
  { label: "Készségek", render: (c) => (c.skills.length ? c.skills.slice(0, 10).join(", ") : "–") },
  { label: "Kezdés, műszak", render: (c) => c.availability ?? "–" },
  { label: "Erősségek (AI)", render: (c) => (c.fit?.strengths.length ? c.fit.strengths.slice(0, 3).join("; ") : "–") },
  { label: "Tisztázandó (AI)", render: (c) => (c.fit?.gaps.length ? c.fit.gaps.slice(0, 3).join("; ") : "–") },
];

async function Compare({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams, requireUser()]);
  const position = await getPosition(id);
  if (!position) notFound();
  const ids = [...new Set([query.c].flat().filter((value): value is string => typeof value === "string"))].slice(0, 4);
  const people = (await Promise.all(ids.map((candidateId) => getCandidate(candidateId)))).filter(
    (candidate): candidate is Candidate => Boolean(candidate && candidate.positionId === position.id),
  );

  return (
    <div className="space-y-6">
      <Link href={`/toborzas/${position.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> {position.title}
      </Link>
      <PageTitle eyebrow={`Összehasonlítás · ${position.title}`} title="Jelöltek" accent="egymás mellett.">
        A kulcsadatok egy táblázatban. Az AI-összevetés segít a mérlegelésben – a döntést te hozod meg.
      </PageTitle>

      {people.length < 2 ? (
        <Panel>
          <p className="text-sm text-white/60">
            Legalább két jelöltet válassz ki az álláshely oldalán (a kártyákon lévő jelölőnégyzettel), majd nyomd meg az „Összehasonlítás”
            gombot.
          </p>
        </Panel>
      ) : (
        <>
          <Panel title="Kulcsadatok" icon={GitCompareArrows}>
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-40 py-2 pr-3 text-left text-xs font-medium text-white/40" scope="col">
                      <span className="sr-only">Szempont</span>
                    </th>
                    {people.map((candidate) => (
                      <th key={candidate.id} scope="col" className="px-3 py-2 text-left align-bottom">
                        <Link href={`/toborzas/${position.id}/jelolt/${candidate.id}`} className="font-display text-base font-semibold hover:text-rose-bright">
                          {candidate.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-white/8 align-top">
                      <th scope="row" className="py-2.5 pr-3 text-left text-xs font-medium text-white/50">
                        {row.label}
                      </th>
                      {people.map((candidate) => (
                        <td key={candidate.id} className="px-3 py-2.5 text-white/80">
                          {row.render(candidate)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="AI-összevetés" icon={Sparkles}>
            <CompareAi positionId={position.id} ids={people.map((candidate) => candidate.id)} aiOn={aiAvailable()} />
          </Panel>
        </>
      )}
    </div>
  );
}

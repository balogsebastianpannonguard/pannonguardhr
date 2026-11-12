import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  ClipboardList,
  FileSearch,
  FileText,
  GitCompareArrows,
  Lightbulb,
  ListChecks,
  MessageCircleQuestionMark,
  PenLine,
  TriangleAlert,
} from "lucide-react";
import { RichText } from "@/components/pajzsi/chat";
import { LegalDiff } from "@/components/legal-diff";
import { LegalItemActions } from "@/components/legal-item-actions";
import { AiNote } from "@/components/legal-note";
import { PageTitle } from "@/components/page-title";
import { Empty, LinkButton, Panel, Pill, Skeleton, type Tone } from "@/components/ui";
import { formatStamp } from "@/lib/dates";
import { LEGAL_KINDS, SEVERITIES, getLegal, type CompareBox, type LegalItem, type QuestionBox, type ReviewBox, type Severity } from "@/lib/legal-hr";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Jog és szabályzat" };

const SEVERITY_TONE: Record<Severity, Tone> = { magas: "error", közepes: "warning", alacsony: "muted" };
const OVERALL_TONE: Record<string, Tone> = { megfelelő: "ok", javítandó: "warning", kockázatos: "error" };
const bySeverity = <T extends { severity: Severity }>(items: T[]) => [...items].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

export default function LegalItemPage({ params }: PageProps<"/jog/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/jog" className="print-hidden inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> Jog és szabályzat
      </Link>
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/jog/[id]">, "params">) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const item = await getLegal(user.id, id);
  if (!item) notFound();

  const plain = plainText(item);
  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle eyebrow={`${LEGAL_KINDS[item.kind]} · ${formatStamp(item.createdAt)}`} title={heading(item)} />
          <LegalItemActions id={item.id} copyText={plain} />
        </div>
        {item.kind === "kerdes" && <QuestionView data={item.data} />}
        {item.kind === "ellenorzes" && <ReviewView data={item.data} />}
        {item.kind === "osszehasonlitas" && <CompareView data={item.data} />}
      </div>
      {/* Nyomtatási nézet: sötét téma nélkül, fekete szöveggel. */}
      <article className="hidden text-[11pt] leading-relaxed whitespace-pre-wrap text-black print:block">
        <p className="mb-1 text-[9pt] text-neutral-500">PannonGuard Biztonsági Szolgáltató Zrt. · HR · {LEGAL_KINDS[item.kind]} · {formatStamp(item.createdAt)}</p>
        {plain}
        {"\n\n"}Tájékoztató jellegű, döntés előtt munkajogász / szakember ellenőrizze.
      </article>
    </>
  );
}

function heading(item: LegalItem) {
  if (item.kind === "kerdes") return item.data.question.length > 90 ? `${item.data.question.slice(0, 88)}…` : item.data.question;
  if (item.kind === "ellenorzes") return item.data.title;
  return `${item.data.titleA} ↔ ${item.data.titleB}`;
}

function QuestionView({ data }: { data: QuestionBox }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel title="Válasz" icon={MessageCircleQuestionMark} className="min-w-0">
        <blockquote className="mb-5 rounded-2xl border-l-2 border-rose/50 bg-white/3 px-4 py-3 text-sm whitespace-pre-wrap text-white/75 [overflow-wrap:anywhere]">
          {data.question}
        </blockquote>
        <div className="space-y-1 text-[15px] leading-relaxed text-white/85 [overflow-wrap:anywhere]">
          <RichText text={data.answer} />
        </div>
        <AiNote className="mt-5" />
      </Panel>
      <div className="print-hidden space-y-3">
        <LinkButton href="/jog" variant="secondary">
          <MessageCircleQuestionMark size={16} aria-hidden /> Új kérdés
        </LinkButton>
        <p className="text-xs text-white/45">
          A jogszabályhelyeket az <a className="text-rose underline underline-offset-2" href="https://njt.hu" target="_blank" rel="noopener noreferrer">njt.hu</a>{" "}
          oldalon a hatályos szöveggel ellenőrizd.
        </p>
      </div>
    </div>
  );
}

function ReviewView({ data }: { data: ReviewBox }) {
  const { result } = data;
  return (
    <div className="space-y-6">
      <Panel
        title="Összefoglaló"
        icon={FileSearch}
        action={
          <div className="flex flex-wrap gap-2">
            <Pill tone="muted">{result.docType}</Pill>
            <Pill tone={OVERALL_TONE[result.overall] ?? "muted"}>{result.overall}</Pill>
          </div>
        }
      >
        <p className="leading-relaxed text-white/80">{result.summary}</p>
        <AiNote className="mt-4" />
      </Panel>

      <Panel title={`Kockázatok (${result.risks.length})`} icon={TriangleAlert}>
        {result.risks.length === 0 ? (
          <p className="text-sm text-white/55">Nem találtam érdemi megfelelőségi kockázatot.</p>
        ) : (
          <ul className="space-y-3">
            {bySeverity(result.risks).map((risk, index) => (
              <li key={index} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{risk.title}</p>
                  <Pill tone={SEVERITY_TONE[risk.severity]}>{risk.severity}</Pill>
                </div>
                {risk.excerpt && <p className="mt-2 border-l-2 border-white/15 pl-3 text-sm text-white/55 italic [overflow-wrap:anywhere]">„{risk.excerpt}”</p>}
                <p className="mt-2 text-sm text-white/75">{risk.explanation}</p>
                {risk.rule && <p className="mt-2 text-xs text-rose-bright/80">Kapcsolódó szabály: {risk.rule}</p>}
                {risk.suggestion && (
                  <p className="mt-2 flex gap-2 text-sm text-white/70">
                    <Lightbulb size={15} aria-hidden className="mt-0.5 shrink-0 text-amber-300" /> {risk.suggestion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title={`Hiányzó elemek (${result.missing.length})`} icon={ClipboardList} className="min-w-0">
          {result.missing.length === 0 ? (
            <p className="text-sm text-white/55">Nem hiányzik kötelező tartalmi elem.</p>
          ) : (
            <ul className="space-y-3">
              {result.missing.map((entry, index) => (
                <li key={index} className="text-sm">
                  <p className="font-medium">{entry.element}</p>
                  <p className="text-white/60">{entry.why}</p>
                  {entry.rule && <p className="mt-0.5 text-xs text-rose-bright/80">{entry.rule}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Teendők" icon={ListChecks} className="min-w-0">
          {result.nextSteps.length === 0 ? (
            <p className="text-sm text-white/55">Nincs külön teendő.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80 marker:text-rose">
              {result.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {result.wording.length > 0 && (
        <Panel title="Javasolt megfogalmazás" icon={PenLine}>
          <ul className="space-y-4">
            {result.wording.map((entry, index) => (
              <li key={index} className="grid gap-2 md:grid-cols-2">
                {entry.original ? (
                  <p className="rounded-xl border-l-2 border-red-400/50 bg-red-500/8 px-3 py-2 text-sm text-white/65 [overflow-wrap:anywhere]">{entry.original}</p>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/12 px-3 py-2 text-sm text-white/40">Új rendelkezés beillesztése</p>
                )}
                <p className="rounded-xl border-l-2 border-emerald-400/50 bg-emerald-400/8 px-3 py-2 text-sm [overflow-wrap:anywhere]">{entry.proposed}</p>
                <p className="text-xs text-white/45 md:col-span-2">{entry.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <details className="pg-panel group rounded-3xl p-5 sm:p-6">
        <summary className="flex cursor-pointer items-center gap-2.5 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose">
            <FileText size={16} aria-hidden />
          </span>
          Az ellenőrzött szöveg
        </summary>
        <div className="mt-4 max-h-[32rem] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-white/65 [overflow-wrap:anywhere]">{data.source}</div>
      </details>
    </div>
  );
}

function CompareView({ data }: { data: CompareBox }) {
  const { result } = data;
  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Érdemi változások" icon={GitCompareArrows} className="min-w-0">
          <p className="leading-relaxed text-white/80">{result.summary}</p>
          {result.changes.length === 0 ? (
            <div className="mt-4">
              <Empty icon={GitCompareArrows} title="Nincs érdemi változás" text="Az eltérések formaiak, a tartalmat nem érintik." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {bySeverity(result.changes).map((change, index) => (
                <li key={index} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold">{change.topic}</p>
                    <Pill tone={SEVERITY_TONE[change.severity]}>{change.severity}</Pill>
                  </div>
                  <p className="mt-2 text-sm text-white/75">{change.change}</p>
                  <p className="mt-2 text-sm text-white/60">
                    <span className="font-medium text-white/75">Hatás: </span>
                    {change.impact}
                  </p>
                  {change.rule && <p className="mt-2 text-xs text-rose-bright/80">Kapcsolódó szabály: {change.rule}</p>}
                </li>
              ))}
            </ul>
          )}
          <AiNote className="mt-5" />
        </Panel>
        <Panel title="Teendők" icon={ListChecks} className="min-w-0">
          {result.actions.length === 0 ? (
            <p className="text-sm text-white/55">Nincs külön teendő.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80 marker:text-rose">
              {result.actions.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
      <Panel title="Szöveges eltérések" icon={FileText}>
        <LegalDiff before={data.before} after={data.after} titleA={data.titleA} titleB={data.titleB} />
      </Panel>
    </div>
  );
}

/** Másoláshoz és nyomtatáshoz: a tétel egyszerű szöveges változata. */
function plainText(item: LegalItem) {
  if (item.kind === "kerdes") return `KÉRDÉS\n${item.data.question}\n\nVÁLASZ\n${item.data.answer.replace(/\*\*/g, "")}`;
  if (item.kind === "ellenorzes") {
    const r = item.data.result;
    return [
      `IRAT-ELLENŐRZÉS: ${item.data.title}`,
      `Típus: ${r.docType} · Értékelés: ${r.overall}`,
      "",
      r.summary,
      "",
      "KOCKÁZATOK",
      ...(r.risks.length
        ? bySeverity(r.risks).map((risk) => `- [${risk.severity}] ${risk.title}: ${risk.explanation}${risk.rule ? ` (${risk.rule})` : ""}${risk.suggestion ? `\n  Javaslat: ${risk.suggestion}` : ""}`)
        : ["- Nincs érdemi kockázat."]),
      "",
      "HIÁNYZÓ ELEMEK",
      ...(r.missing.length ? r.missing.map((entry) => `- ${entry.element}: ${entry.why}${entry.rule ? ` (${entry.rule})` : ""}`) : ["- Nincs."]),
      ...(r.wording.length ? ["", "JAVASOLT MEGFOGALMAZÁS", ...r.wording.map((entry) => `- ${entry.original ? `Helyette: „${entry.original}”\n  ` : ""}Javasolt: „${entry.proposed}” – ${entry.reason}`)] : []),
      "",
      "TEENDŐK",
      ...r.nextSteps.map((step, index) => `${index + 1}. ${step}`),
    ].join("\n");
  }
  const r = item.data.result;
  return [
    `ÖSSZEHASONLÍTÁS: ${item.data.titleA} ↔ ${item.data.titleB}`,
    "",
    r.summary,
    "",
    "ÉRDEMI VÁLTOZÁSOK",
    ...(r.changes.length
      ? bySeverity(r.changes).map((change) => `- [${change.severity}] ${change.topic}: ${change.change}\n  Hatás: ${change.impact}${change.rule ? ` (${change.rule})` : ""}`)
      : ["- Nincs érdemi változás."]),
    "",
    "TEENDŐK",
    ...r.actions.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
}

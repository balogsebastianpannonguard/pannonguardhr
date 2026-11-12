import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Car,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  MessageSquareText,
  NotebookPen,
  Pencil,
  Phone,
  ShieldCheck,
  UserCheck,
  Wrench,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import {
  AiRunButton,
  DeleteCandidateButton,
  DeleteInterviewButton,
  HireForm,
  InterviewForm,
  NotesForm,
  ProfileForm,
  RatingControl,
  RejectionDraft,
  ScorecardForm,
  StageControl,
} from "@/components/recruitment-candidate";
import { CopyButton } from "@/components/recruitment-tools";
import { Panel, Pill, Skeleton } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { dayKey, formatShortDate, formatStamp } from "@/lib/dates";
import { QUALIFICATION_KINDS } from "@/lib/employees";
import { getCandidate, getPosition } from "@/lib/recruitment";
import { CANDIDATE_SOURCES, STAGES, STAGE_TONE } from "@/lib/recruitment-meta";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Jelölt" };
export const maxDuration = 120;

type Props = PageProps<"/toborzas/[id]/jelolt/[candidateId]">;

export default function CandidatePage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[48rem]" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<Props, "params">) {
  const [{ id, candidateId }, user] = await Promise.all([params, requireUser()]);
  const [candidate, position] = await Promise.all([getCandidate(candidateId), getPosition(id)]);
  if (!candidate || !position || candidate.positionId !== position.id) notFound();
  const aiOn = aiAvailable();
  const today = dayKey(new Date());

  return (
    <div className="space-y-6">
      <Link href={`/toborzas/${position.id}`} className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
        <ArrowLeft size={15} aria-hidden /> {position.title}
      </Link>

      <PageTitle eyebrow={`Jelölt · ${position.title}`} title={candidate.name}>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={STAGE_TONE[candidate.stage]}>{STAGES[candidate.stage]}</Pill>
          <span className="text-white/45">
            {CANDIDATE_SOURCES[candidate.source]} · {formatStamp(candidate.createdAt)}
          </span>
        </span>
      </PageTitle>

      <Panel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="mb-2 text-sm font-medium text-white/60">Szakasz</p>
            <StageControl id={candidate.id} stage={candidate.stage} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-white/60">Saját értékelésed</p>
            <RatingControl id={candidate.id} rating={candidate.rating} />
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Profil" icon={FileText}>
            <Profile candidate={candidate} />
          </Panel>

          <Panel title="AI illeszkedés" icon={Gauge} action={<AiRunButton id={candidate.id} kind="fit" aiOn={aiOn} done={Boolean(candidate.fit)} />}>
            <SupportNote />
            {candidate.fit ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <ScoreRing score={candidate.fit.score} />
                  <p className="text-sm leading-relaxed text-white/70">{candidate.fit.summary}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <BulletList title="Erősségek" items={candidate.fit.strengths} tone="text-emerald-300" />
                  <BulletList title="Hiányok, tisztázandó" items={candidate.fit.gaps} tone="text-amber-200" />
                </div>
                {candidate.fit.questions.length > 0 && <BulletList title="Javasolt kérdések" items={candidate.fit.questions} tone="text-pink-bright" />}
                <p className="text-xs text-white/35">Elemzés: {formatStamp(candidate.fit.at)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/50">Még nincs elemzés. Az AI a jelölt profilját veti össze az álláshely elvárásaival.</p>
            )}
          </Panel>

          <Panel
            title="Interjúkérdések"
            icon={MessageSquareText}
            action={<AiRunButton id={candidate.id} kind="questions" aiOn={aiOn} done={Boolean(candidate.questions)} />}
          >
            {candidate.questions?.list.length ? (
              <div className="space-y-3">
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-white/75 marker:text-rose">
                  {candidate.questions.list.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-white/35">AI-javaslat, {formatStamp(candidate.questions.at)} – válogasd és igazítsd.</p>
                  <CopyButton text={candidate.questions.list.map((question, index) => `${index + 1}. ${question}`).join("\n")} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/50">Generálj az önéletrajzhoz és az álláshoz igazított kérdéseket (szakmai, helyzetgyakorlat, motiváció).</p>
            )}
          </Panel>

          <Panel title="Interjú-értékelőlap" icon={ClipboardCheck}>
            <ScorecardForm id={candidate.id} scorecard={candidate.scorecard} />
          </Panel>

          <Panel title="Profil szerkesztése" icon={Pencil}>
            <ProfileForm candidate={{ ...candidate, cvText: undefined }} />
          </Panel>

          {candidate.cvText && (
            <Panel title="Az önéletrajz kinyert szövege" icon={FileText}>
              <details>
                <summary className="cursor-pointer text-sm text-white/60 hover:text-white">Megjelenítés</summary>
                <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-black/25 p-4 font-sans text-xs leading-relaxed whitespace-pre-wrap text-white/70">
                  {candidate.cvText}
                </pre>
              </details>
              <p className="mt-2 text-xs text-white/35">Az eredeti fájlt nem tároljuk, csak ezt a szöveget és a kinyert profilt.</p>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Interjúk" icon={CalendarClock}>
            {candidate.interviews.length > 0 && (
              <ul className="mb-4 space-y-2">
                {candidate.interviews.map((interview) => (
                  <li key={interview.id} className={`flex items-start gap-2 rounded-xl border border-white/8 p-3 text-sm ${interview.date < today ? "opacity-60" : "bg-rose/5"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {formatShortDate(interview.date)} · {interview.time}
                      </p>
                      <p className="truncate text-white/55">{interview.place}</p>
                      <p className="truncate text-xs text-white/40">Interjúztató: {interview.interviewer}</p>
                      {interview.note && <p className="mt-1 text-xs text-white/55">{interview.note}</p>}
                    </div>
                    <DeleteInterviewButton candidateId={candidate.id} interviewId={interview.id} />
                  </li>
                ))}
              </ul>
            )}
            <InterviewForm id={candidate.id} interviewer={user.name} />
          </Panel>

          <Panel title="Jegyzet" icon={NotebookPen}>
            <NotesForm id={candidate.id} notes={candidate.notes} />
          </Panel>

          <Panel title="Felvétel" icon={UserCheck}>
            <p className="mb-3 text-sm text-white/55">
              A munkavállaló „Belépés alatt” állapotban jön létre a jelölt adataival; a többit (szerződés, okmányok) a munkavállaló oldalán
              töltöd ki.
            </p>
            <HireForm id={candidate.id} employeeId={candidate.employeeId} eligible={candidate.stage === "ajanlat" || candidate.stage === "felveve"} />
          </Panel>

          <Panel title="Elutasítás" icon={Mail}>
            <RejectionDraft id={candidate.id} initial={candidate.rejectionDraft} />
          </Panel>

          <Panel title="Előzmények" icon={Clock}>
            <ol className="space-y-2.5">
              {[...candidate.history].reverse().slice(0, 30).map((entry, index) => (
                <li key={`${String(entry.at)}-${index}`} className="text-sm">
                  <p>{entry.action}</p>
                  <p className="text-xs text-white/40">
                    {entry.by} · {formatStamp(entry.at)}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Adatvédelem" icon={ShieldCheck}>
            <p className="mb-3 text-sm text-white/55">A törlés a jelölt minden adatát (profil, jegyzet, értékelés, interjúk) véglegesen eltávolítja.</p>
            <DeleteCandidateButton id={candidate.id} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Profile({ candidate }: { candidate: NonNullable<Awaited<ReturnType<typeof getCandidate>>> }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-white/70">
        {candidate.email && (
          <a href={`mailto:${candidate.email}`} className="flex min-w-0 items-center gap-1.5 hover:text-rose-bright">
            <Mail size={14} aria-hidden className="shrink-0 text-rose" /> <span className="truncate">{candidate.email}</span>
          </a>
        )}
        {candidate.phone && (
          <a href={`tel:${candidate.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-rose-bright">
            <Phone size={14} aria-hidden className="text-rose" /> {candidate.phone}
          </a>
        )}
        {candidate.location && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} aria-hidden className="text-rose" /> {candidate.location}
          </span>
        )}
        {candidate.drivingLicence && (
          <span className="flex items-center gap-1.5">
            <Car size={14} aria-hidden className="text-rose" /> {candidate.drivingLicence}
          </span>
        )}
        {candidate.availability && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden className="text-rose" /> {candidate.availability}
          </span>
        )}
      </div>
      {candidate.summary && <p className="leading-relaxed text-white/75">{candidate.summary}</p>}

      {candidate.experience.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/45 uppercase">Munkatapasztalat</h3>
          <ol className="space-y-2 border-l border-rose/25 pl-4">
            {candidate.experience.map((item, index) => (
              <li key={index}>
                <p className="font-medium">
                  {item.role || "Munkakör"}
                  {item.employer && <span className="text-white/55"> · {item.employer}</span>}
                </p>
                <p className="text-xs text-white/45">{item.period}</p>
                {item.description && <p className="mt-0.5 text-white/60">{item.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {candidate.qualifications.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/45 uppercase">
              <BadgeCheck size={13} aria-hidden /> Képesítések, igazolványok
            </h3>
            <ul className="space-y-1.5">
              {candidate.qualifications.map((item, index) => (
                <li key={index}>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-white/45">
                    {[QUALIFICATION_KINDS[item.kind], item.number, item.expiresAt && `érvényes: ${item.expiresAt}`].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {candidate.education.length > 0 && <Chips title="Végzettség" icon={GraduationCap} items={candidate.education} />}
        {candidate.languages.length > 0 && <Chips title="Nyelvek" icon={Languages} items={candidate.languages} />}
        {candidate.skills.length > 0 && <Chips title="Készségek" icon={Wrench} items={candidate.skills} />}
      </div>
    </div>
  );
}

function Chips({ title, icon: Icon, items }: { title: string; icon: typeof Wrench; items: string[] }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/45 uppercase">
        <Icon size={13} aria-hidden /> {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <span key={index} className="rounded-lg bg-white/6 px-2 py-1 text-xs text-white/75">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function BulletList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className={`mb-1.5 text-xs font-semibold tracking-wide uppercase ${tone}`}>{title}</h3>
      <ul className="space-y-1 text-sm text-white/70">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden className={tone}>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const length = 2 * Math.PI * 26;
  return (
    <div className="relative grid size-20 shrink-0 place-items-center" aria-label={`Illeszkedés: ${score}%`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-rose)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * length} ${length}`} />
      </svg>
      <span className="font-display text-xl font-semibold">{score}%</span>
    </div>
  );
}

function SupportNote() {
  return (
    <p className="rounded-xl border border-amber-300/20 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
      Döntéstámogatás, nem döntés: az AI csak a szakmai adatok alapján becsül, tévedhet. A pontszám segít a sorrendben, de a jelöltről
      mindig te döntesz.
    </p>
  );
}

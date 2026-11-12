import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Briefcase, BriefcaseBusiness, Clock, Inbox, MapPin, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { PurgeRejectedForm } from "@/components/recruitment-tools";
import { Empty, LinkButton, Panel, Pill, Skeleton, Stat } from "@/components/ui";
import { EMPLOYMENT_TYPES } from "@/lib/employees";
import { countStaleRejected, listPositions } from "@/lib/recruitment";
import { POSITION_STATUS, POSITION_TONE, STAGES, STAGE_ORDER, STAGE_TONE } from "@/lib/recruitment-meta";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Toborzás" };

const RETENTION_DAYS = 180;

export default function RecruitmentPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Toborzás és kiválasztás" title="Nyitott" accent="álláshelyek.">
          Álláshirdetés, önéletrajzok, interjúk és döntés egy helyen – az AI segít, a döntés mindig a tiéd.
        </PageTitle>
        <LinkButton href="/toborzas/uj">
          <Plus size={17} aria-hidden /> Új álláshely
        </LinkButton>
      </div>
      <Suspense fallback={<RecruitmentSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  await requireUser();
  const [rows, stale] = await Promise.all([listPositions(), countStaleRejected(RETENTION_DAYS)]);
  const open = rows.filter((row) => row.status === "nyitott");
  const sum = (stages: (keyof typeof STAGES)[]) => rows.reduce((total, row) => total + stages.reduce((n, stage) => n + (row.counts[stage] ?? 0), 0), 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Nyitott álláshely" value={open.length} icon={Briefcase} tone="text-rose-bright" hint={`${open.reduce((n, row) => n + row.headcount, 0)} fő keresett létszám`} />
        <Stat label="Folyamatban lévő jelölt" value={sum(["beerkezett", "szures", "interju", "ajanlat"])} icon={Users} tone="text-pink-bright" />
        <Stat label="Interjú szakaszban" value={sum(["interju"])} icon={Clock} />
        <Stat label="Felvéve" value={sum(["felveve"])} icon={UserCheck} tone="text-emerald-300" />
      </div>

      {rows.length === 0 ? (
        <Empty
          icon={BriefcaseBusiness}
          title="Még nincs álláshely"
          text="Hozd létre az első álláshelyet: utána AI-val megírhatod a hirdetést, és feltöltheted a beérkezett önéletrajzokat."
          action={
            <LinkButton href="/toborzas/uj">
              <Plus size={17} aria-hidden /> Új álláshely
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row, index) => (
            <li key={row.id} className="pg-rise" style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}>
              <Link href={`/toborzas/${row.id}`} className="pg-card block h-full rounded-2xl p-5 hover:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">{row.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
                      {row.department && <span className="truncate">{row.department}</span>}
                      {row.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} aria-hidden /> {row.location}
                        </span>
                      )}
                    </p>
                  </div>
                  <Pill tone={POSITION_TONE[row.status]}>{POSITION_STATUS[row.status]}</Pill>
                </div>
                <p className="mt-3 text-xs text-white/45">
                  {EMPLOYMENT_TYPES[row.employmentType]} · {row.headcount} fő{row.schedule ? ` · ${row.schedule}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {row.total === 0 ? (
                    <span className="flex items-center gap-1.5 text-xs text-white/40">
                      <Inbox size={13} aria-hidden /> Még nincs jelölt
                    </span>
                  ) : (
                    STAGE_ORDER.filter((stage) => row.counts[stage]).map((stage) => (
                      <Pill key={stage} tone={STAGE_TONE[stage]}>
                        {STAGES[stage]}: {row.counts[stage]}
                      </Pill>
                    ))
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Panel title="Adatvédelem" icon={ShieldCheck}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2 text-sm leading-relaxed text-white/60">
            <p>
              Az elutasított jelöltek adatait csak addig tartsd meg, ameddig a kiválasztáshoz (és egy esetleges panasz kezeléséhez)
              feltétlenül szükséges – kivéve, ha a jelölt kifejezetten hozzájárult a későbbi megkereséshez. Egyenként a jelölt oldalán,
              tömegesen itt törölhetsz.
            </p>
            <p>
              {stale ? (
                <span className="text-amber-200">
                  {stale} elutasított jelölt adata {RETENTION_DAYS} napnál régebben van a rendszerben.
                </span>
              ) : (
                <span className="text-emerald-300">Nincs {RETENTION_DAYS} napnál régebben elutasított jelölt.</span>
              )}
            </p>
          </div>
          <PurgeRejectedForm defaultDays={RETENTION_DAYS} />
        </div>
      </Panel>
    </div>
  );
}

function RecruitmentSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

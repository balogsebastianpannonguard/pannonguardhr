import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileSignature, GraduationCap, HandCoins, UserRoundMinus } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { RepaymentSelect } from "@/components/training-actions";
import { TrainingTabs } from "@/components/training-tabs";
import { Empty, Pill, Skeleton, Stat } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { recentLeavers } from "@/lib/trainings";
import { TRAINING_TYPES, formatHuf } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Kilépők képzései" };

export default function LeaversPage() {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Munkaügy · Képzések" title="Kilépők" accent="követése.">
        Az elmúlt 12 hónapban kilépett kollégák és a képzéseik. Ahol tanulmányi szerződés tartozik hozzá, itt követheted a
        visszafizetés rendezését.
      </PageTitle>
      <TrainingTabs current="/kepzesek/kilepok" />
      <Suspense fallback={<Skeleton className="h-[28rem]" />}>
        <Leavers />
      </Suspense>
    </div>
  );
}

const fullDate = (day?: string) => (day ? `${day.slice(0, 4)}. ${formatShortDate(day)}` : "–");

async function Leavers() {
  await requireUser();
  const leavers = await recentLeavers(12);
  const contracts = leavers.flatMap((leaver) => leaver.trainings.filter((training) => training.studyContract));
  const open = contracts.filter((training) => training.repayment !== "rendezve" && training.repayment !== "nem_esedekes");

  if (!leavers.length)
    return <Empty icon={UserRoundMinus} title="Nincs kilépő az elmúlt 12 hónapban" text="Ha egy dolgozó kilépését rögzítik, itt látod a képzéseit és a tanulmányi szerződéseit." />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Kilépő (12 hónap)" value={leavers.length} icon={UserRoundMinus} />
        <Stat label="Tanulmányi szerződés" value={contracts.length} icon={FileSignature} tone="text-rose-bright" hint={`Összesen ${formatHuf(contracts.reduce((sum, item) => sum + (item.studyAmount ?? 0), 0))}`} />
        <Stat label="Rendezetlen" value={open.length} icon={HandCoins} tone={open.length ? "text-amber-300" : "text-white"} hint={`Összesen ${formatHuf(open.reduce((sum, item) => sum + (item.studyAmount ?? 0), 0))}`} />
      </div>

      <ul className="space-y-3">
        {leavers.map((leaver) => {
          const pending = leaver.trainings.some((training) => training.studyContract && training.repayment !== "rendezve" && training.repayment !== "nem_esedekes");
          return (
            <li key={leaver.employeeId} className={`pg-card rounded-2xl p-4 ${pending ? "border-amber-300/30" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/kepzesek/dolgozo/${leaver.employeeId}`} className="font-semibold hover:text-rose">
                    {leaver.name}
                  </Link>
                  <p className="text-xs text-white/50">
                    {leaver.position} · Kilépett: {fullDate(leaver.exitDate)}
                    {leaver.exitReason && ` · ${leaver.exitReason}`}
                  </p>
                </div>
                {pending ? <Pill tone="warning" icon={FileSignature}>Visszafizetés ellenőrzendő</Pill> : <Pill tone="muted">{leaver.trainings.length} képzés</Pill>}
              </div>
              {leaver.trainings.length === 0 ? (
                <p className="mt-3 text-sm text-white/45">Nem szerepelt rögzített képzésen.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/6 rounded-xl border border-white/8">
                  {leaver.trainings.map((training) => (
                    <li key={training.trainingId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                      <GraduationCap size={15} aria-hidden className="shrink-0 text-rose" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/kepzesek/${training.trainingId}`} className="text-sm font-medium hover:text-rose">
                          {training.name}
                        </Link>
                        <p className="text-xs text-white/45">
                          {TRAINING_TYPES[training.type]} · {fullDate(training.date)}
                        </p>
                      </div>
                      {training.studyContract ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="warning">Tanulmányi szerződés · {formatHuf(training.studyAmount)}</Pill>
                          <RepaymentSelect trainingId={training.trainingId} employeeId={leaver.employeeId} value={training.repayment} />
                        </div>
                      ) : (
                        <span className="text-xs text-white/40">Nincs tanulmányi szerződés</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

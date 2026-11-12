import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CircleAlert, CircleCheck, TimerReset } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { TrainingTabs } from "@/components/training-tabs";
import { Empty, Panel, Pill, Skeleton, Stat } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import { expiryText, expiryTone } from "@/lib/employees";
import { requireUser } from "@/lib/session";
import { trainingExpiries, type TrainingExpiry } from "@/lib/trainings";
import { TRAINING_TYPES } from "@/lib/trainings-meta";

export const metadata: Metadata = { title: "Lejáró tanúsítványok" };

export default function TrainingExpiriesPage() {
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Munkaügy · Képzések" title="Lejáró" accent="tanúsítványok.">
        A következő 90 napban lejáró és a már lejárt képzési tanúsítványok az aktív dolgozóknál. Ha valaki azóta újra
        elvégezte a képzést, csak a legfrissebb számít.
      </PageTitle>
      <TrainingTabs current="/kepzesek/lejaratok" />
      <Suspense fallback={<Skeleton className="h-[28rem]" />}>
        <Expiries />
      </Suspense>
    </div>
  );
}

async function Expiries() {
  await requireUser();
  const items = await trainingExpiries(90);
  const expired = items.filter((item) => item.daysLeft < 0);
  const soon = items.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30);
  const later = items.filter((item) => item.daysLeft > 30);

  if (!items.length)
    return <Empty icon={CircleCheck} title="Minden tanúsítvány érvényes" text="A következő 90 napban nem jár le képzési tanúsítvány. Szép munka!" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Már lejárt" value={expired.length} icon={CircleAlert} tone={expired.length ? "text-red-300" : "text-white"} />
        <Stat label="30 napon belül" value={soon.length} icon={CalendarClock} tone={soon.length ? "text-amber-300" : "text-white"} />
        <Stat label="31–90 napon belül" value={later.length} icon={TimerReset} tone="text-rose-bright" />
      </div>
      {[
        { title: "Lejárt", list: expired },
        { title: "30 napon belül lejár", list: soon },
        { title: "31–90 napon belül lejár", list: later },
      ]
        .filter((group) => group.list.length)
        .map((group) => (
          <Panel key={group.title} title={group.title} icon={TimerReset} action={<Pill tone="muted">{group.list.length} tétel</Pill>}>
            <ExpiryList items={group.list} />
          </Panel>
        ))}
    </div>
  );
}

function ExpiryList({ items }: { items: TrainingExpiry[] }) {
  return (
    <ul className="divide-y divide-white/6">
      {items.map((item) => (
        <li key={`${item.trainingId}-${item.employeeId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/kepzesek/dolgozo/${item.employeeId}`} className="font-medium hover:text-rose">
              {item.employeeName}
            </Link>
            <p className="truncate text-xs text-white/50">
              <Link href={`/kepzesek/${item.trainingId}`} className="hover:text-white">
                {item.label}
              </Link>{" "}
              · {TRAINING_TYPES[item.trainingType]}
            </p>
          </div>
          <span className="text-sm text-white/60 tabular-nums">
            {item.date.slice(0, 4)}. {formatShortDate(item.date)}
          </span>
          <Pill tone={expiryTone(item.daysLeft)}>{expiryText(item.daysLeft)}</Pill>
        </li>
      ))}
    </ul>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CalendarRange, OctagonAlert, TimerReset } from "lucide-react";
import { ExpiryList } from "@/components/employee-expiry-list";
import { PageTitle } from "@/components/page-title";
import { Panel, Skeleton, Stat } from "@/components/ui";
import { EXPIRY_KINDS, type ExpiryKind } from "@/lib/employees";
import { allExpiries } from "@/lib/expiries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Lejáratok" };

export default function ExpiriesPage({ searchParams }: PageProps<"/lejaratok">) {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Állomány" title="Lejáratok" accent="figyelése.">
        Orvosi alkalmasság, vagyonőri igazolvány, képesítések, próbaidő és határozott idejű szerződések – a következő 90 nap és ami már
        lejárt.
      </PageTitle>
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <Expiries searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const isKind = (value: string): value is ExpiryKind => Object.hasOwn(EXPIRY_KINDS, value);

async function Expiries({ searchParams }: Pick<PageProps<"/lejaratok">, "searchParams">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const raw = Array.isArray(params.tipus) ? params.tipus[0] : (params.tipus ?? "");
  const kind = isKind(raw) ? raw : undefined;
  const all = await allExpiries(90);
  const items = kind ? all.filter((item) => item.kind === kind) : all;

  const expired = items.filter((item) => item.daysLeft < 0);
  const soon = items.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30);
  const later = items.filter((item) => item.daysLeft > 30);
  const countOf = (value: ExpiryKind) => all.filter((item) => item.kind === value).length;

  const chips: { key: string; label: string; count: number }[] = [
    { key: "", label: "Mind", count: all.length },
    ...(Object.keys(EXPIRY_KINDS) as ExpiryKind[]).map((key) => ({ key, label: EXPIRY_KINDS[key], count: countOf(key) })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lejárt" value={expired.length} icon={OctagonAlert} tone={expired.length ? "text-red-300" : "text-white"} />
        <Stat label="30 napon belül" value={soon.length} icon={CalendarClock} tone={soon.length ? "text-amber-300" : "text-white"} />
        <Stat label="31–90 nap" value={later.length} icon={CalendarRange} tone="text-rose-bright" />
      </div>

      <nav aria-label="Szűrés típus szerint" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = (kind ?? "") === chip.key;
          return (
            <Link
              key={chip.key || "all"}
              href={chip.key ? `/lejaratok?tipus=${chip.key}` : "/lejaratok"}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
                active ? "bg-rose/20 font-semibold text-rose-bright ring-1 ring-rose/40" : "bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              {chip.label}
              <span className="tabular-nums text-xs opacity-70">{chip.count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Panel title={`Lejárt (${expired.length})`} icon={OctagonAlert}>
          <ExpiryList items={expired} empty="Nincs lejárt tétel – szép munka!" />
        </Panel>
        <Panel title={`30 napon belül (${soon.length})`} icon={CalendarClock}>
          <ExpiryList items={soon} empty="A következő 30 napban nem jár le semmi." />
        </Panel>
        <Panel title={`31–90 nap (${later.length})`} icon={TimerReset}>
          <ExpiryList items={later} empty="Ebben az időszakban nem jár le semmi." />
        </Panel>
      </div>
    </div>
  );
}

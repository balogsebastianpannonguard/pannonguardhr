import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  FileText,
  LogIn,
  MonitorSmartphone,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Pill } from "@/components/ui";
import { formatStamp, greeting } from "@/lib/dates";
import { loadActivity } from "@/lib/overview";
import { countActiveSessions, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Áttekintés" };

/** A HR munkaterületei, amelyek fokozatosan kerülnek a rendszerbe. */
const AREAS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Munkavállalók", text: "A csapat tagjai, elérhetőségek és munkakörök egy helyen.", icon: Users },
  { title: "Iratok", text: "Szerződések, orvosi és egyéb igazolások, lejárati figyelmeztetéssel.", icon: FileText },
  { title: "Felvétel", text: "Az új kollégák beléptetése lépésről lépésre, semmi nem marad ki.", icon: UserRoundPlus },
  { title: "Szabadság és távollét", text: "Kérelmek, jóváhagyás és éves keret átláthatóan.", icon: CalendarDays },
];

const today = new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", year: "numeric", month: "long", day: "numeric", weekday: "long" });

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const now = new Date();
  const [activity, sessions] = await Promise.all([loadActivity(user.session.userId, now), countActiveSessions(user.session.userId)]);

  const cards: { label: string; value: string; note: string; icon: LucideIcon; tone: string; href?: string }[] = [
    {
      label: "Kétlépcsős azonosítás",
      value: user.totpEnabledAt ? "Aktív" : "Hiányzik",
      note: user.totpEnabledAt ? `${formatStamp(user.totpEnabledAt)} óta védett a fiókod` : "Állítsd be a hitelesítőt",
      icon: ShieldCheck,
      tone: user.totpEnabledAt ? "text-rose-bright" : "text-amber-300",
    },
    {
      label: "Aktív munkamenet",
      value: String(sessions),
      note: sessions === 1 ? "csak ez az eszköz" : "eszközön vagy belépve",
      icon: MonitorSmartphone,
      tone: "text-pink-bright",
      href: "/biztonsag",
    },
    {
      label: "Belépések (30 nap)",
      value: String(activity.logins30),
      note: activity.previousLogin ? `Előző: ${formatStamp(activity.previousLogin)}` : "Ez az első belépésed – üdv a csapatban!",
      icon: activity.failures ? CircleAlert : LogIn,
      tone: activity.failures ? "text-amber-300" : "text-white",
      href: "/biztonsag",
    },
  ];

  return (
    <div className="space-y-8">
      {params.udv === "1" && (
        <div className="pg-rise flex items-center gap-4 rounded-2xl border border-rose/25 bg-linear-to-r from-rose/15 to-transparent p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose/20 text-rose">
            <PartyPopper size={22} aria-hidden />
          </span>
          <div>
            <p className="font-semibold">A fiókod elkészült, a hitelesítő aktív.</p>
            <p className="text-sm text-white/60">Innentől a belépéshez a jelszavad és a telefonod kódja is kell.</p>
          </div>
        </div>
      )}

      <section className="pg-panel pg-rise relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-pink/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-rose/20 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-rose uppercase">
            <Sparkles size={15} aria-hidden /> HR · {today.format(now)}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            {greeting(now)},
            <br />
            <span className="pg-accent-text">{user.firstName}!</span>
          </h1>
          <p className="mt-4 max-w-xl text-white/65">
            Örülünk, hogy itt vagy. Ez a PannonGuard HR felülete: itt kapnak majd helyet a munkavállalók, az iratok és a felvétel
            lépései. A fiókod készen áll, a többi részt hamarosan építjük.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, note, icon: Icon, tone, href }, index) => {
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white/60">{label}</p>
                <Icon size={18} aria-hidden className={tone} />
              </div>
              <p className={`mt-3 font-display text-3xl font-semibold ${tone}`}>{value}</p>
              <p className="mt-1 truncate text-xs text-white/45">{note}</p>
            </>
          );
          const className = "pg-card pg-rise block rounded-2xl bg-linear-to-br from-rose/10 to-transparent p-5";
          const style = { animationDelay: `${0.1 + index * 0.06}s` };
          return href ? (
            <Link key={label} href={href} className={`${className} hover:bg-white/5`} style={style}>
              {body}
            </Link>
          ) : (
            <div key={label} className={className} style={style}>
              {body}
            </div>
          );
        })}
      </div>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold">Ami hamarosan érkezik</h2>
          <Pill tone="muted">Fejlesztés alatt</Pill>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {AREAS.map(({ title, text, icon: Icon }, index) => (
            <div key={title} className="pg-card pg-rise rounded-2xl p-5" style={{ animationDelay: `${0.25 + index * 0.06}s` }}>
              <span className="grid size-10 place-items-center rounded-xl bg-pink/15 text-pink-bright">
                <Icon size={19} aria-hidden />
              </span>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-white/50">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-white/40">
        <CircleCheck size={14} aria-hidden className="text-rose" /> A fiókod kétlépcsős azonosítással védett; a biztonsági
        részleteket a Biztonság oldalon látod.
      </p>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="pg-skeleton h-64 rounded-[2rem]" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="pg-skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="pg-skeleton h-40 rounded-3xl" />
    </div>
  );
}

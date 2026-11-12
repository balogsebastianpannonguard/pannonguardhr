import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarOff,
  CircleAlert,
  FileText,
  GraduationCap,
  LogIn,
  LogOut,
  MailOpen,
  MonitorSmartphone,
  PartyPopper,
  Scale,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserRoundCheck,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ExpiryList } from "@/components/employee-expiry-list";
import { Panel, Stat } from "@/components/ui";
import { formatStamp, greeting } from "@/lib/dates";
import { headcountSummary } from "@/lib/employees";
import { allExpiries } from "@/lib/expiries";
import { loadActivity } from "@/lib/overview";
import { countActiveSessions, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Áttekintés" };

/** A HR modulok gyorselérése (a menü sorrendjében). */
const MODULES: { href: string; title: string; text: string; icon: LucideIcon }[] = [
  { href: "/munkavallalok", title: "Munkavállalók", text: "Törzsadatok, munkaviszony, képesítések", icon: Users },
  { href: "/lejaratok", title: "Lejáratok", text: "Orvosi, igazolvány, szerződés, próbaidő", icon: TimerReset },
  { href: "/tavollet", title: "Távollétek", text: "Szabadság, betegség, keretek", icon: CalendarOff },
  { href: "/be-kilepes", title: "Belépés és kilépés", text: "Teendőlisták, iratok, határidők", icon: UserRoundCheck },
  { href: "/dokumentumok", title: "HR-dokumentumok", text: "Szerződések és nyilatkozatok", icon: FileText },
  { href: "/toborzas", title: "Toborzás", text: "Hirdetések és jelöltek", icon: BriefcaseBusiness },
  { href: "/kepzesek", title: "Képzések", text: "Oktatások, részvétel, érvényesség", icon: GraduationCap },
  { href: "/kimutatasok", title: "Kimutatások", text: "Létszám, fluktuáció, riportok", icon: BarChart3 },
  { href: "/jog", title: "Jog és szabályzat", text: "Munkajog és belső szabályok", icon: Scale },
  { href: "/kommunikacio", title: "Kommunikáció", text: "Körlevelek és értesítések", icon: MailOpen },
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
  const [activity, sessions, headcount, expiries] = await Promise.all([
    loadActivity(user.session.userId, now),
    countActiveSessions(user.session.userId),
    headcountSummary(now),
    allExpiries(90),
  ]);
  const urgent = expiries.slice(0, 6);
  const expiredCount = expiries.filter((item) => item.daysLeft < 0).length;

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

      <section className="pg-panel pg-rise relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
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
            Itt a mai kép a csapatról: létszám, közelgő lejáratok és minden HR-modul egy kattintásra.
          </p>
        </div>
      </section>

      <section aria-label="Létszám" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/munkavallalok?status=aktiv" className="pg-rise block transition hover:opacity-90" style={{ animationDelay: "0.1s" }}>
          <Stat label="Aktív munkavállaló" value={headcount.counts.aktiv} icon={Users} tone="text-rose-bright" hint={headcount.counts.szunetel ? `+ ${headcount.counts.szunetel} szünetel` : undefined} />
        </Link>
        <Link href="/munkavallalok?status=belepes" className="pg-rise block transition hover:opacity-90" style={{ animationDelay: "0.16s" }}>
          <Stat label="Belépés alatt" value={headcount.counts.belepes} icon={UserRoundPlus} tone="text-pink-bright" />
        </Link>
        <div className="pg-rise" style={{ animationDelay: "0.22s" }}>
          <Stat label="E havi belépő" value={headcount.joiners} icon={LogIn} />
        </div>
        <div className="pg-rise" style={{ animationDelay: "0.28s" }}>
          <Stat label="E havi kilépő" value={headcount.leavers} icon={LogOut} tone={headcount.leavers ? "text-amber-300" : "text-white"} />
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel
          title="Legsürgősebb lejáratok"
          icon={TimerReset}
          action={
            <Link href="/lejaratok" className="inline-flex items-center gap-1 text-sm text-rose hover:text-rose-bright">
              {expiredCount ? `${expiredCount} lejárt · ` : ""}Összes <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          <ExpiryList items={urgent} compact empty="A következő 90 napban nem jár le semmi." />
        </Panel>

        <section>
          <h2 className="mb-4 font-display text-lg font-semibold">Modulok</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODULES.map(({ href, title, text, icon: Icon }, index) => (
              <Link
                key={href}
                href={href}
                className="pg-card pg-rise group flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/5"
                style={{ animationDelay: `${0.2 + index * 0.04}s` }}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink/15 text-pink-bright">
                  <Icon size={19} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{title}</span>
                  <span className="block truncate text-xs text-white/50">{text}</span>
                </span>
                <ArrowRight size={16} aria-hidden className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-rose" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="Fiókbiztonság" className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ label, value, note, icon: Icon, tone, href }) => {
          const body = (
            <>
              <Icon size={17} aria-hidden className={`shrink-0 ${tone}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-white/50">{label}</span>
                <span className="block truncate text-xs text-white/35">{note}</span>
              </span>
              <span className={`shrink-0 text-sm font-semibold ${tone}`}>{value}</span>
            </>
          );
          const className = "flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3";
          return href ? (
            <Link key={label} href={href} className={`${className} transition hover:bg-white/6`}>
              {body}
            </Link>
          ) : (
            <div key={label} className={className}>
              {body}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="pg-skeleton h-64 rounded-[2rem]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="pg-skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="pg-skeleton h-80 rounded-3xl" />
    </div>
  );
}

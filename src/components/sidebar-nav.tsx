"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarOff,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MailOpen,
  Scale,
  ShieldCheck,
  TimerReset,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavGroup = { title: string; links: { href: string; label: string; icon: LucideIcon }[] };

const GROUPS: NavGroup[] = [
  { title: "Munka", links: [{ href: "/", label: "Áttekintés", icon: LayoutDashboard }] },
  {
    title: "Állomány",
    links: [
      { href: "/munkavallalok", label: "Munkatársak", icon: Users },
      { href: "/lejaratok", label: "Lejáratok", icon: TimerReset },
      { href: "/tavollet", label: "Távollétek", icon: CalendarOff },
    ],
  },
  {
    title: "Munkaügy",
    links: [
      { href: "/be-kilepes", label: "Belépés és kilépés", icon: UserRoundCheck },
      { href: "/dokumentumok", label: "HR-dokumentumok", icon: FileText },
      { href: "/toborzas", label: "Toborzás", icon: BriefcaseBusiness },
      { href: "/kepzesek", label: "Képzések", icon: GraduationCap },
    ],
  },
  {
    title: "Tudás és riport",
    links: [
      { href: "/kimutatasok", label: "Kimutatások", icon: BarChart3 },
      { href: "/jog", label: "Jog és szabályzat", icon: Scale },
      { href: "/kommunikacio", label: "Kommunikáció", icon: MailOpen },
    ],
  },
  { title: "Fiók", links: [{ href: "/biztonsag", label: "Biztonság", icon: ShieldCheck }] },
];

export function SidebarNav({ compact = false }: { compact?: boolean }) {
  return (
    <Suspense fallback={<NavList compact={compact} pathname={null} />}>
      <LiveNav compact={compact} />
    </Suspense>
  );
}

function LiveNav({ compact }: { compact: boolean }) {
  return <NavList compact={compact} pathname={usePathname()} />;
}

function NavList({ compact, pathname }: { compact: boolean; pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  if (compact) {
    return (
      <nav aria-label="Fő navigáció" className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
        {GROUPS.flatMap((group) => group.links).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className="pg-nav-link flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <Icon size={16} aria-hidden className="text-white/45" />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Fő navigáció" className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3.5 text-[0.62rem] font-semibold tracking-[0.2em] text-white/35 uppercase">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className="pg-nav-link flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <Icon size={17} aria-hidden className="text-white/45 transition-colors" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

import Link from "next/link";
import { GraduationCap, TimerReset, UserRoundMinus, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/kepzesek", label: "Képzések", icon: GraduationCap },
  { href: "/kepzesek/lejaratok", label: "Lejáró tanúsítványok", icon: TimerReset },
  { href: "/kepzesek/kilepok", label: "Kilépők", icon: UserRoundMinus },
];

/** A Képzések menü nézetei (szerveroldali, az aktív fül a `current` alapján). */
export function TrainingTabs({ current, counts = {} }: { current: string; counts?: Record<string, number> }) {
  return (
    <nav aria-label="Képzések nézetei" className="print-hidden -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-rose/15 text-rose-bright ring-1 ring-rose/30" : "text-white/60 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
            {counts[href] ? <span className="rounded-full bg-white/10 px-1.5 text-xs tabular-nums">{counts[href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

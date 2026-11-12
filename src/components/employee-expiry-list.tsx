import Link from "next/link";
import { Award, CalendarClock, FileClock, GraduationCap, HeartPulse, Hourglass, IdCard, type LucideIcon } from "lucide-react";
import { Pill } from "@/components/ui";
import { expiryText, expiryTone, formatDate, type Expiry, type ExpiryKind } from "@/lib/employee-meta";

export const EXPIRY_ICONS: Record<ExpiryKind, LucideIcon> = {
  orvosi: HeartPulse,
  vagyonor: IdCard,
  kepesites: Award,
  szerzodes: FileClock,
  probaido: Hourglass,
  kepzes: GraduationCap,
};

const ICON_TONE = { error: "bg-red-500/12 text-red-200", warning: "bg-amber-400/12 text-amber-200", muted: "bg-white/6 text-white/60" } as const;

/**
 * Lejárati tételek listája (újrahasznosítható): ikon, megnevezés, dolgozó, dátum és „X nap múlva / lejárt” jelzés.
 * `showEmployee={false}` egy dolgozó saját oldalán; `compact` sűrűbb sorokat ad (pl. áttekintő kártyán).
 */
export function ExpiryList({
  items,
  showEmployee = true,
  compact = false,
  empty = "Nincs figyelendő lejárat.",
}: {
  items: Expiry[];
  showEmployee?: boolean;
  compact?: boolean;
  empty?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-white/55">
        <CalendarClock size={16} aria-hidden className="text-emerald-300" /> {empty}
      </p>
    );
  }
  return (
    <ul className={compact ? "space-y-1" : "space-y-2"}>
      {items.map((item, index) => {
        const Icon = EXPIRY_ICONS[item.kind];
        const tone = expiryTone(item.daysLeft);
        const body = (
          <>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${ICON_TONE[tone]}`}>
              <Icon size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{showEmployee ? item.employeeName : item.label}</span>
              <span className="block truncate text-xs text-white/50">
                {showEmployee ? `${item.label} · ` : ""}
                {formatDate(item.date)}
              </span>
            </span>
            <Pill tone={tone}>{expiryText(item.daysLeft)}</Pill>
          </>
        );
        const className = `flex items-center gap-3 rounded-xl ${compact ? "px-2 py-2" : "border border-white/8 bg-white/3 px-3 py-2.5"}`;
        return (
          <li key={`${item.employeeId}-${item.kind}-${item.label}-${index}`}>
            {showEmployee ? (
              <Link href={`/munkavallalok/${item.employeeId}`} className={`${className} transition hover:bg-white/6`}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

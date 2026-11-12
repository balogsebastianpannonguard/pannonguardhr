import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  LogIn,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  ShieldX,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { listUserAudit, type AuditEvent } from "@/lib/audit";
import { logoutEverywhere } from "@/lib/auth-actions";
import { formatStamp } from "@/lib/dates";
import { countActiveSessions, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Biztonság" };

const EVENTS: Record<AuditEvent, { label: string; icon: LucideIcon; tone: string }> = {
  register: { label: "Regisztráció", icon: UserRoundPlus, tone: "text-pink-bright" },
  "totp.enabled": { label: "Hitelesítő bekapcsolva", icon: ShieldCheck, tone: "text-rose" },
  "login.success": { label: "Sikeres belépés", icon: LogIn, tone: "text-emerald-300" },
  "login.failure": { label: "Hibás jelszó", icon: CircleAlert, tone: "text-red-300" },
  "login.locked": { label: "Zárolt belépés", icon: ShieldX, tone: "text-red-300" },
  "totp.failure": { label: "Hibás hitelesítő kód", icon: KeyRound, tone: "text-amber-300" },
  logout: { label: "Kijelentkezés", icon: LogOut, tone: "text-white/60" },
  "logout.all": { label: "Kijelentkezés minden eszközről", icon: LogOut, tone: "text-white/60" },
  "password.reset": { label: "Jelszó visszaállítva", icon: KeyRound, tone: "text-rose" },
};

function device(userAgent: string) {
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Ismeretlen eszköz";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "";
  return browser ? `${browser} · ${os}` : os;
}

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Biztonság" title="A fiókod" accent="védelme.">
        Itt látod a fiókod adatait, a kétlépcsős azonosítás állapotát és a legutóbbi belépéseket.
      </PageTitle>
      <Suspense fallback={<div className="pg-skeleton h-[32rem] rounded-3xl" />}>
        <Security />
      </Suspense>
    </div>
  );
}

async function Security() {
  const user = await requireUser();
  const [events, activeSessions] = await Promise.all([
    listUserAudit(user.session.userId),
    countActiveSessions(user.session.userId),
  ]);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="pg-panel rounded-3xl p-6">
          <h2 className="font-display text-lg font-semibold">Fiók</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Név" value={user.name} />
            <Row label="E-mail" value={user.email} />
            <Row label="Munkakör" value="HR" />
            <Row label="Meghívott" value={user.invitedBy} />
            <Row label="Regisztrált" value={formatStamp(user.createdAt)} />
          </dl>
        </section>

        <section className="pg-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <CircleCheck size={22} aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">Kétlépcsős azonosítás</h2>
              <p className="text-sm text-emerald-300">
                Aktív {user.totpEnabledAt && `· ${formatStamp(user.totpEnabledAt)} óta`}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Ha elveszíted a telefonodat vagy új eszközre váltasz, szólj az adminisztrátornak, aki
            visszaállítja a hozzáférésedet.
          </p>
        </section>

        <section className="pg-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-pink/25 text-pink-bright">
              <MonitorSmartphone size={22} aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold">Aktív munkamenetek</h2>
              <p className="text-sm text-white/55">{activeSessions} eszközön vagy belépve</p>
            </div>
          </div>
          <form action={logoutEverywhere} className="mt-4">
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
            >
              <LogOut size={15} aria-hidden /> Kijelentkezés minden eszközről
            </button>
          </form>
        </section>
      </div>

      <section className="pg-panel rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Legutóbbi események</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-white/55">Még nincs rögzített esemény.</p>
        ) : (
          <ol className="mt-4 space-y-1">
            {events.map((entry, index) => {
              const meta = EVENTS[entry.event];
              const Icon = meta?.icon ?? CircleAlert;
              return (
                <li
                  key={`${entry.at.toISOString()}-${index}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/4"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white/5 ${meta?.tone ?? ""}`}>
                    <Icon size={16} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{meta?.label ?? entry.event}</p>
                    <p className="truncate text-xs text-white/45">
                      {device(entry.userAgent)} · {entry.ip}
                    </p>
                  </div>
                  <time dateTime={entry.at.toISOString()} className="shrink-0 text-xs text-white/50">
                    {formatStamp(entry.at)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/50">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}

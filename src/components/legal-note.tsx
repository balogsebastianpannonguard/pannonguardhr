import Link from "next/link";
import { Info, KeyRound } from "lucide-react";

/** A minden AI-válasz alatt kötelező figyelmeztetés. */
export function AiNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/6 px-3 py-2 text-xs text-amber-100/85 ${className}`}>
      <Info size={14} aria-hidden className="mt-0.5 shrink-0 text-amber-300" />
      Tájékoztató jellegű, döntés előtt munkajogász / szakember ellenőrizze.
    </p>
  );
}

export function NoAiBanner({ what }: { what: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/8 p-4 text-sm text-amber-100">
      <KeyRound size={18} aria-hidden className="mt-0.5 shrink-0 text-amber-300" />
      <p>
        {what} AI-t használ, de a szerveren nincs beállítva a <strong>GEMINI_API_KEY</strong>. A kulcs megadása után a funkció
        azonnal működik.
      </p>
    </div>
  );
}

/** Adatvédelmi emlékeztető az AI-hoz küldött szövegekhez. */
export function PrivacyHint() {
  return (
    <p className="text-xs text-white/45">
      A szöveg feldolgozásra az AI-szolgáltatóhoz (Google Gemini) kerül. Ahol lehet, név helyett írd azt, hogy „a munkavállaló”,
      és ne adj meg azonosítót, egészségügyi vagy béradatot. A mentett tartalom titkosítva tárolódik.
    </p>
  );
}

const TABS = [
  { href: "/jog", label: "Munkajogi kérdés" },
  { href: "/jog/ellenorzes", label: "Irat ellenőrzése" },
  { href: "/jog/osszehasonlitas", label: "Összehasonlítás" },
] as const;

export function LegalTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Jogi eszközök" className="print-hidden -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition ${
            tab.href === active ? "bg-rose/15 text-rose-bright ring-1 ring-rose/30 ring-inset" : "text-white/60 hover:bg-white/6 hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

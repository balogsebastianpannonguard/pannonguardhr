import { Scale } from "lucide-react";

/** Minden jogi sablon mellett megjelenő figyelmeztetés (nyomtatásban nem látszik). */
export function HrDocLegalNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/8 p-4 text-sm leading-relaxed text-amber-100 print:hidden ${className}`}>
      <Scale size={18} aria-hidden className="mt-0.5 shrink-0 text-amber-300" />
      <span>
        <strong className="font-semibold">Mintaszöveg – aláírás előtt munkajogásszal ellenőriztesd.</strong> A sablon a munka törvénykönyve (2012. évi I. tv.) alapján készült, de nem
        helyettesíti a jogi tanácsadást: az egyedi körülményekhez és a jogszabályok aktuális állapotához igazítani kell.
      </span>
    </p>
  );
}

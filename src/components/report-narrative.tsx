"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, Printer, Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { draftReportNarrative } from "@/lib/actions/reports";

const storageKey = (period: string) => `pg-hr-riport:${period}`;

/**
 * A riport szöveges értékelése: AI-vázlat (csak összesített számokból), amelyet nyomtatás előtt szabadon átírhatsz.
 * A szöveg csak ebben a böngészőben marad meg (kényelmi mentés), a szerverre nem kerül.
 */
export function ReportNarrative({ period, params, aiOn }: { period: string; params: { idoszak: string; tol?: string; ig?: string }; aiOn: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [aiDraft, setAiDraft] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(period));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a böngészőben mentett vázlat betöltése csatoláskor
      if (saved) setText(saved);
    } catch {
      /* privát mód: nincs helyi mentés */
    }
  }, [period]);

  function update(value: string) {
    setText(value);
    try {
      if (value) window.localStorage.setItem(storageKey(period), value);
      else window.localStorage.removeItem(storageKey(period));
    } catch {
      /* nincs helyi tárhely */
    }
  }

  function draft() {
    if (text.trim() && !window.confirm("A meglévő szöveget lecseréli az új AI-vázlat. Folytatod?")) return;
    setError(undefined);
    start(async () => {
      const result = await draftReportNarrative(params);
      if (result.error) setError(result.error);
      else if (result.text) {
        update(result.text);
        setAiDraft(true);
      }
    });
  }

  return (
    <section className="break-inside-avoid">
      <h2 className="text-lg font-bold">Értékelés</h2>
      <div className="print-hidden mt-2 space-y-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={draft} disabled={pending || !aiOn} className={buttonClass("primary", "sm")}>
            {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Sparkles size={15} aria-hidden />}
            {text.trim() ? "Új AI-vázlat" : "AI-vázlat készítése"}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#d1d5db] px-3 text-sm font-medium text-[#14182b] hover:bg-white">
            <Printer size={15} aria-hidden /> Nyomtatás
          </button>
          <p className="text-xs text-[#6b7280]">
            {aiOn ? "Az AI csak az összesített számokat kapja meg, neveket és személyes adatot nem." : "AI-kulcs nélkül a szöveget kézzel írhatod meg."}
          </p>
        </div>
        {aiDraft && (
          <p className="rounded-lg bg-[#fdf2f4] px-3 py-2 text-xs text-[#9c3a66]">
            AI által készített vázlat – nyomtatás előtt olvasd át, és javítsd, ahol szükséges.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-[#b91c1c]">{error}</p>}
        <textarea
          value={text}
          onChange={(event) => update(event.target.value)}
          rows={14}
          maxLength={8000}
          aria-label="A riport szöveges értékelése"
          placeholder="Írd ide a vezetői értékelést, vagy kérj AI-vázlatot a fenti gombbal."
          className="w-full rounded-lg border border-[#d1d5db] bg-white p-3 text-sm leading-relaxed text-[#14182b] outline-none focus:border-[#c9806d] focus:ring-2 focus:ring-[#e8a796]/40"
        />
      </div>
      <div className="mt-2 hidden text-sm leading-relaxed whitespace-pre-wrap print:block">{text.trim() || "–"}</div>
    </section>
  );
}

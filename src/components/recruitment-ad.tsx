"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, Printer, Save, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/recruitment-tools";
import { Feedback, Select, Textarea, buttonClass } from "@/components/ui";
import { generateAd, saveAd } from "@/lib/actions/recruitment";
import { AD_TONES } from "@/lib/recruitment-meta";

/** Álláshirdetés: AI-vázlat a választott hangnemben, szerkeszthető szöveg, másolás és nyomtatható nézet. */
export function AdEditor({ positionId, initialText, initialTone, aiOn }: { positionId: string; initialText?: string; initialTone?: string; aiOn: boolean }) {
  const [tone, setTone] = useState(initialTone ?? "baratsagos");
  const [text, setText] = useState(initialText ?? "");
  const [saved, setSaved] = useState(initialText ?? "");
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-white/70">Hangnem</span>
          <Select value={tone} onChange={(event) => setTone(event.target.value)} className="h-9 w-40 text-sm">
            {Object.entries(AD_TONES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <button
          type="button"
          disabled={generating || !aiOn}
          onClick={() => {
            if (text.trim() && text !== saved && !confirm("A nem mentett módosításaid elvesznek. Készüljön új vázlat?")) return;
            startGenerate(async () => {
              setFeedback({});
              const result = await generateAd(positionId, tone);
              if (result.text) {
                setText(result.text);
                setSaved(result.text);
                setFeedback({ message: "Elkészült a vázlat – olvasd át és igazítsd, mielőtt közzéteszed." });
              } else setFeedback({ error: result.error });
            });
          }}
          className={buttonClass("primary", "sm")}
        >
          {generating ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Sparkles size={15} aria-hidden />}
          {generating ? "Írom a hirdetést…" : "Álláshirdetés készítése AI-val"}
        </button>
      </div>
      {!aiOn && (
        <p className="flex gap-1.5 text-xs text-amber-200/90">
          <KeyRound size={13} aria-hidden className="mt-0.5 shrink-0" /> Az AI-vázlathoz GEMINI_API_KEY szükséges; a hirdetést kézzel is megírhatod.
        </p>
      )}
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={14}
        maxLength={12_000}
        placeholder="Itt jelenik meg a hirdetés szövege. Írhatod kézzel is."
        aria-label="Álláshirdetés szövege"
        className="min-h-72 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || text === saved}
          onClick={() =>
            startSave(async () => {
              const result = await saveAd(positionId, text, tone);
              if (result.ok) setSaved(text);
              setFeedback(result);
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          {saving ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />} Mentés
        </button>
        <CopyButton text={text} />
        {saved && (
          <Link href={`/toborzas/${positionId}/hirdetes`} className={buttonClass("ghost", "sm")}>
            <Printer size={15} aria-hidden /> Nyomtatható nézet
          </Link>
        )}
        {text !== saved && <span className="text-xs text-amber-200/80">Nem mentett módosítás</span>}
      </div>
      <Feedback error={feedback.error} message={feedback.message} />
    </div>
  );
}

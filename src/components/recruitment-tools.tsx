"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, GitCompareArrows, LoaderCircle, Printer, Sparkles, Trash2 } from "lucide-react";
import { Feedback, Input, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { compareCandidates, deletePosition, purgeRejected } from "@/lib/actions/recruitment";
import type { FormState } from "@/lib/form";

export function CopyButton({ text, label = "Másolás" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      className={buttonClass("secondary", "sm")}
    >
      {copied ? <Check size={15} aria-hidden className="text-emerald-300" /> : <Copy size={15} aria-hidden />}
      {copied ? "Kimásolva" : label}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "sm")}>
      <Printer size={15} aria-hidden /> Nyomtatás / PDF
    </button>
  );
}

/** AI-összevetés a kiválasztott jelöltekről; az eredmény csak itt jelenik meg, nem mentjük. */
export function CompareAi({ positionId, ids, aiOn }: { positionId: string; ids: string[]; aiOn: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ text?: string; error?: string }>({});
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !aiOn}
          onClick={() => start(async () => setResult(await compareCandidates(positionId, ids)))}
          className={buttonClass("primary", "sm")}
        >
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Sparkles size={15} aria-hidden />}
          {pending ? "Összevetés készül…" : result.text ? "Új összevetés" : "AI-összevetés készítése"}
        </button>
        {result.text && <CopyButton text={result.text} />}
      </div>
      {!aiOn && <p className="text-xs text-amber-200/90">Az AI-összevetéshez GEMINI_API_KEY szükséges; a táblázat nélküle is használható.</p>}
      {result.error && <p role="alert" className="text-sm text-red-300">{result.error}</p>}
      {result.text && (
        <div className="rounded-2xl border border-rose/20 bg-rose/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-rose uppercase">
            <GitCompareArrows size={13} aria-hidden /> AI-vázlat – döntéstámogatás, ellenőrizd
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/80">{result.text}</p>
        </div>
      )}
    </div>
  );
}

export function PurgeRejectedForm({ defaultDays = 180 }: { defaultDays?: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(purgeRejected, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form
      ref={ref}
      onSubmit={(event) => {
        if (!confirm("Biztosan véglegesen törlöd a feltételnek megfelelő elutasított jelöltek adatait? Ez nem vonható vissza.")) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-white/70">Napnál régebben elutasítottak</span>
          <Input name="days" type="number" min={0} max={3650} defaultValue={defaultDays} className="w-32" />
        </label>
        <button type="submit" disabled={pending} className={buttonClass("danger")}>
          {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Trash2 size={16} aria-hidden />}
          Elutasított jelöltek törlése
        </button>
      </div>
      <Feedback error={state.error} message={state.ok ? state.message : undefined} />
    </form>
  );
}

export function DeletePositionButton({ id, count }: { id: string; count: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("danger", "sm")}
        onClick={() => {
          if (!confirm(`Biztosan törlöd az álláshelyet${count ? ` és mind a(z) ${count} jelöltjének adatait` : ""}? Ez nem vonható vissza.`)) return;
          start(async () => {
            const result = await deletePosition(id);
            setError(result?.error);
          });
        }}
      >
        {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Álláshely törlése
      </button>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

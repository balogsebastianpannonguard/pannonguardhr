"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, Bug, CircleCheck, Lightbulb, LoaderCircle, Send } from "lucide-react";
import type { PajzsiApi, TicketResult } from "@/components/pajzsi/api";
import { Confetti } from "@/components/pajzsi/confetti";

const KINDS = [
  { key: "hiba", label: "Hiba", hint: "Valami nem működik", icon: Bug },
  { key: "keres", label: "Kérés", hint: "Új funkció, módosítás", icon: Lightbulb },
] as const;
const PRIORITIES = [
  { key: "alacsony", label: "Alacsony", tone: "border-emerald-400/50 bg-emerald-400/10 text-emerald-100" },
  { key: "normal", label: "Normál", tone: "border-pink-bright/60 bg-pink/20 text-white" },
  { key: "surgos", label: "Sürgős", tone: "border-red-400/60 bg-red-500/15 text-red-100" },
] as const;

export function TicketForm({
  api,
  page,
  initialText,
  diagnostics = [],
  onBack,
  onDone,
  onHappy,
}: {
  api: PajzsiApi;
  page: string;
  initialText: string;
  diagnostics?: string[];
  onBack: () => void;
  onDone: () => void;
  onHappy: () => void;
}) {
  const [kind, setKind] = useState<string>("hiba");
  const [priority, setPriority] = useState<string>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(initialText);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [attachLog, setAttachLog] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const response = await api.ticket({ kind, priority, title, description, page, diagnostics: attachLog ? diagnostics : [] });
        setResult(response);
        if (response.ok) onHappy();
      } catch {
        setResult({ error: "Nem sikerült elérni a szervert, próbáld újra." });
      }
    });
  }

  if (result?.ok) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Confetti />
        <span className="pg-pop grid size-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
          <CircleCheck size={34} aria-hidden />
        </span>
        <div className="pg-pop">
          <p className="font-display text-lg font-semibold">Köszönöm, felvettem!</p>
          <p className="mt-1 text-sm text-white/60">
            A jegy azonosítója <span className="rounded-md border border-rose/50 bg-ink-950 px-2 py-0.5 font-mono text-rose">{result.number}</span>
          </p>
        </div>
        <p className="text-xs leading-relaxed text-white/50">
          {result.emailed ? "Értesítő levél ment a fejlesztőnek, és a válasz a belépési e-mail-címedre érkezik." : "A jegy el van mentve, de az értesítő levelet most nem sikerült elküldeni. Szólj egy kollégának."}
        </p>
        <button type="button" onClick={onDone} className="pg-button h-11 rounded-xl px-6 text-sm font-semibold">
          Rendben
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm [scrollbar-width:thin]">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Típus">
          {KINDS.map(({ key, label, hint, icon: Icon }) => (
            <button key={key} type="button" role="radio" aria-checked={kind === key} onClick={() => setKind(key)} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${kind === key ? "border-rose/70 bg-rose/10" : "border-white/10 bg-white/4 hover:border-white/25"}`}>
              <Icon size={18} aria-hidden className={kind === key ? "text-rose" : "text-white/50"} />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-[0.7rem] text-white/45">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60">Rövid cím</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder={kind === "hiba" ? "pl. A belépésnél nem fogadja el a kódot" : "pl. Szabadságnyilvántartás a rendszerben"} className="pg-field h-11 w-full rounded-xl bg-transparent px-3.5 text-sm text-white outline-none placeholder:text-white/30" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60">{kind === "hiba" ? "Mit tapasztalsz? Mit vártál helyette?" : "Mit szeretnél, és mire jó?"}</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} required rows={5} className="pg-field w-full resize-none rounded-xl bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/30" placeholder="Írd le lépésről lépésre. Személyes adatot (jelszó, lakcím, azonosító) ne írj be." />
        </label>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold tracking-wide text-white/60">Mennyire sürgős?</legend>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map(({ key, label, tone }) => (
              <button key={key} type="button" aria-pressed={priority === key} onClick={() => setPriority(key)} className={`h-10 rounded-xl border text-xs font-semibold transition ${priority === key ? tone : "border-white/10 bg-white/4 text-white/55 hover:border-white/25"}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2 rounded-lg bg-white/4 px-3 py-2 text-[0.7rem] text-white/45">
          <p>
            Automatikusan mellékelem: a jelenlegi oldalt (<span className="font-mono text-white/70">{page}</span>), az eszközöd típusát és a neved.
          </p>
          {diagnostics.length > 0 && (
            <div className="border-t border-white/8 pt-2">
              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-white/70">
                  <input type="checkbox" checked={attachLog} onChange={(event) => setAttachLog(event.target.checked)} className="size-3.5 accent-rose" />
                  Technikai napló ({diagnostics.length} bejegyzés) mellékelése
                </label>
                <button type="button" onClick={() => setShowLog(!showLog)} className="text-rose hover:underline">
                  {showLog ? "Elrejt" : "Megnéz"}
                </button>
              </div>
              {showLog && (
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-md bg-ink-950/70 p-2 font-mono text-[0.62rem] leading-snug text-white/65 [scrollbar-width:thin]">
                  {diagnostics.map((line, index) => (
                    <li key={index} className="break-words">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {result?.error && (
          <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {result.error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-white/8 p-3">
        <button type="button" onClick={onBack} className="flex h-11 items-center gap-1.5 rounded-xl border border-white/12 px-4 text-sm text-white/70 transition hover:border-white/30 hover:text-white">
          <ArrowLeft size={16} aria-hidden /> Vissza
        </button>
        <button type="submit" disabled={pending} className="pg-button flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60">
          {pending ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : <Send size={16} aria-hidden />}
          Bejelentés elküldése
        </button>
      </div>
    </form>
  );
}

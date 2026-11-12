"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { Braces, Check, Eye, LoaderCircle, PenLine, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { HrDocPaper, displayValues, type Signature, type TemplateField } from "@/components/hrdoc-paper";
import { Feedback, Input, buttonClass, fieldClass } from "@/components/ui";
import { aiRewriteTemplate, resetTemplate, saveTemplate, type RewriteState } from "@/lib/actions/hr-documents";
import type { FormState } from "@/lib/form";

export function HrDocTemplateEditor({
  templateKey,
  title,
  body: initial,
  custom,
  standard,
  fields,
  sampleValues,
  signatures,
  aiEnabled,
}: {
  templateKey: string;
  title: string;
  body: string;
  custom: boolean;
  standard: { key: string; label: string }[];
  fields: TemplateField[];
  sampleValues: Record<string, string>;
  signatures: Signature[];
  aiEnabled: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [preview, setPreview] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveTemplate, {});
  const [resetting, startReset] = useTransition();
  const [resetState, setResetState] = useState<FormState>({});

  const [aiState, aiAction, aiPending] = useActionState<RewriteState, FormData>(aiRewriteTemplate, {});
  const [range, setRange] = useState<[number, number] | null>(null);
  const [instruction, setInstruction] = useState("");
  const [dismissed, setDismissed] = useState<RewriteState | null>(null);

  const labels = Object.fromEntries([...standard, ...fields].map((field) => [field.key, field.label]));
  const values = displayValues({ ...sampleValues, ...Object.fromEntries(fields.filter((field) => field.default).map((field) => [field.key, field.default!])) }, fields);

  function insert(key: string) {
    const element = textarea.current;
    const token = `{{${key}}}`;
    if (!element) return setBody((current) => current + token);
    const { selectionStart, selectionEnd } = element;
    setBody((current) => current.slice(0, selectionStart) + token + current.slice(selectionEnd));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart + token.length, selectionStart + token.length);
    });
  }

  function askAi() {
    const element = textarea.current;
    const selection: [number, number] | null = element && element.selectionEnd - element.selectionStart >= 20 ? [element.selectionStart, element.selectionEnd] : null;
    setRange(selection);
    setDismissed(null);
    const formData = new FormData();
    formData.set("source", selection ? body.slice(...selection) : body);
    formData.set("instruction", instruction);
    startTransition(() => aiAction(formData));
  }

  function acceptDraft(draft: string) {
    setBody((current) => (range ? current.slice(0, range[0]) + draft + current.slice(range[1]) : draft));
    setDismissed(aiState);
  }

  const showDraft = aiState.ok && aiState.draft && dismissed !== aiState;

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="key" value={templateKey} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
            <button type="button" onClick={() => setPreview(false)} className={`${buttonClass(preview ? "ghost" : "secondary", "sm")}`}>
              <PenLine size={14} aria-hidden /> Szöveg
            </button>
            <button type="button" onClick={() => setPreview(true)} className={`${buttonClass(preview ? "secondary" : "ghost", "sm")}`}>
              <Eye size={14} aria-hidden /> Előnézet
            </button>
          </div>
          <p className="text-xs text-white/40">{body.length.toLocaleString("hu-HU")} karakter</p>
        </div>

        <div className={preview ? "hidden" : "space-y-3"}>
          <textarea
            ref={textarea}
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={26}
            maxLength={60_000}
            spellCheck
            aria-label={`${title} – sablonszöveg`}
            className={`${fieldClass} min-h-[28rem] py-3 font-mono text-xs leading-relaxed`}
          />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-[0.15em] text-white/40 uppercase">
              <Braces size={13} aria-hidden /> Helyőrző beszúrása a kurzorhoz
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...fields, ...standard.filter((field) => !fields.some((extra) => extra.key === field.key))].map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => insert(field.key)}
                  title={`{{${field.key}}}`}
                  className={`rounded-lg px-2 py-1 text-xs transition ${
                    fields.some((extra) => extra.key === field.key) ? "bg-pink/15 text-pink-bright hover:bg-pink/25" : "bg-white/6 text-white/65 hover:bg-white/12"
                  }`}
                >
                  {field.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-white/35">Rózsaszín: a sablon saját, dokumentumonként kitöltendő mezői. Szürke: a nyilvántartásból töltődik.</p>
          </div>
        </div>
        {preview && <HrDocPaper title={title} body={body} values={values} labels={labels} signatures={signatures} />}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
          <button
            type="button"
            disabled={resetting || !custom}
            title={custom ? undefined : "Most is az alapértelmezett szöveg van érvényben."}
            onClick={() => {
              if (!window.confirm("Visszaállítod az alapértelmezett szöveget? A módosításaid elvesznek.")) return;
              startReset(async () => {
                const result = await resetTemplate(templateKey);
                setResetState(result);
                if (result.body) setBody(result.body);
              });
            }}
            className={buttonClass("ghost", "sm")}
          >
            {resetting ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <RotateCcw size={14} aria-hidden />} Visszaállítás alapértelmezettre
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <Feedback error={state.error ?? resetState.error} message={state.ok ? state.message : resetState.message} />
            <button type="submit" disabled={pending} className={buttonClass("primary")}>
              {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Save size={16} aria-hidden />} Sablon mentése
            </button>
          </div>
        </div>
      </form>

      {aiEnabled && (
        <section className="pg-aurora space-y-3 rounded-2xl border border-pink/25 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} aria-hidden className="text-pink-bright" /> Átfogalmazás AI-jal
          </p>
          <p className="text-xs leading-relaxed text-white/55">
            Jelölj ki egy bekezdést a szövegben (vagy semmit – akkor a teljes sablon megy), és írd le, mit változtasson. Az AI csak a helyőrzős sablonszöveget kapja, személyes adatot
            nem – ezért ne írj a sablonba konkrét nevet vagy azonosítót. Az eredmény vázlat: átvétel előtt olvasd el.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={600} placeholder="Pl. Legyen közérthetőbb, és tegezés helyett magázó formában" aria-label="Utasítás az AI-nak" />
            <button type="button" disabled={aiPending || instruction.trim().length < 3} onClick={askAi} className={`${buttonClass("secondary")} shrink-0`}>
              {aiPending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Sparkles size={16} aria-hidden />} Vázlat kérése
            </button>
          </div>
          <Feedback error={aiState.error} />
          {showDraft && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-ink-950/60 p-3">
              <p className="text-xs font-semibold tracking-[0.15em] text-pink-bright uppercase">AI-vázlat {range ? "· a kijelölt részhez" : "· a teljes szöveghez"}</p>
              {aiState.warning && <p className="text-xs text-amber-200">{aiState.warning}</p>}
              <pre className="max-h-80 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/80">{aiState.draft}</pre>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setDismissed(aiState)} className={buttonClass("ghost", "sm")}>
                  <X size={14} aria-hidden /> Elvetés
                </button>
                <button type="button" onClick={() => acceptDraft(aiState.draft!)} className={buttonClass("primary", "sm")}>
                  <Check size={14} aria-hidden /> Átvétel a szerkesztőbe
                </button>
              </div>
              <p className="text-xs text-white/35">Az átvétel után a „Sablon mentése” gombbal rögzítheted.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

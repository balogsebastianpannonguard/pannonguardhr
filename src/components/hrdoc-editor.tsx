"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, CircleAlert, LoaderCircle, LockKeyhole, RotateCcw, Save } from "lucide-react";
import { HrDocPaper, displayValues, fillText, missingKeys, type Signature, type TemplateField } from "@/components/hrdoc-paper";
import { Feedback, Input, Label, Textarea, buttonClass, fieldClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { saveHrDocument } from "@/lib/actions/hr-documents";
import type { FormState } from "@/lib/form";

export type StandardField = { key: string; label: string; secret?: boolean };

export function HrDocEditor({
  id,
  templateKey,
  employeeId,
  title,
  number,
  templateBody,
  initialBody,
  standard,
  fields,
  initialValues,
  signatures,
}: {
  id?: string;
  templateKey: string;
  employeeId: string;
  title: string;
  number?: string;
  /** A sablon aktuális szövege (a „visszaállítás a sablonra” gombhoz). */
  templateBody: string;
  initialBody: string;
  standard: StandardField[];
  fields: TemplateField[];
  initialValues: Record<string, string>;
  signatures: Signature[];
}) {
  const [values, setValues] = useState(initialValues);
  const [body, setBody] = useState(initialBody);
  const [state, action, pending] = useActionState<FormState, FormData>(saveHrDocument, {});
  const { ref, onSubmit } = useKeepForm(action, state);

  const extraKeys = new Set(fields.map((field) => field.key));
  const registry = standard.filter((field) => !extraKeys.has(field.key));
  const labels = useMemo(
    () => Object.fromEntries([...standard.map((field) => [field.key, field.label]), ...fields.map((field) => [field.key, field.label])]),
    [standard, fields],
  );
  const shown = useMemo(() => displayValues(values, fields), [values, fields]);
  const missing = useMemo(() => {
    const filled = fillText(body, shown);
    const signatureKeys = ["nev", "munkaltato", "munkaltato_kepviselo"].filter((key) => !shown[key] && signatures.length > 0);
    return [...new Set([...missingKeys(filled), ...signatureKeys])];
  }, [body, shown, signatures.length]);

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form ref={ref} onSubmit={onSubmit} className="grid items-start gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="templateKey" value={templateKey} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="values" value={JSON.stringify(values)} />

      <div className="space-y-4 print:hidden">
        <section className="pg-panel space-y-4 rounded-3xl p-5">
          <h2 className="font-display text-lg font-semibold">Kitöltendő mezők</h2>
          {fields.map((field) => (
            <Label key={field.key} label={field.label} hint={field.hint}>
              {field.type === "textarea" ? (
                <Textarea value={values[field.key] ?? ""} onChange={(event) => set(field.key, event.target.value)} rows={3} maxLength={8000} className="min-h-20 text-sm" />
              ) : (
                <Input
                  type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                  maxLength={field.type === "text" ? 500 : undefined}
                />
              )}
            </Label>
          ))}
        </section>

        <details className="pg-panel group rounded-3xl p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-lg font-semibold">
            Adatok a nyilvántartásból
            <ChevronDown size={18} aria-hidden className="text-white/50 transition group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-xs text-white/45">
            A munkavállaló adatlapjáról töltöttük ki. Itt csak ebben a dokumentumban írhatod felül; a törzsadat nem változik. A <LockKeyhole size={11} aria-hidden className="inline" /> jelű
            mezők bizalmasak, a mentett dokumentumban titkosítva tároljuk őket.
          </p>
          <div className="mt-4 space-y-3">
            {registry.map((field) => (
              <Label
                key={field.key}
                label={field.label}
                hint={!values[field.key] ? <span className="text-amber-300/80">Hiányzik a nyilvántartásból</span> : undefined}
              >
                <div className="relative">
                  <Input value={values[field.key] ?? ""} onChange={(event) => set(field.key, event.target.value)} maxLength={500} className={field.secret ? "pr-9" : ""} />
                  {field.secret && <LockKeyhole size={14} aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2 text-white/35" />}
                </div>
              </Label>
            ))}
          </div>
        </details>

        <details className="pg-panel group rounded-3xl p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-lg font-semibold">
            A szöveg szerkesztése
            <ChevronDown size={18} aria-hidden className="text-white/50 transition group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-xs text-white/45">
            Csak ezt a dokumentumot módosítja. A <code className="text-rose-bright">{"{{…}}"}</code> helyére kerülnek az adatok; <code className="text-rose-bright"># </code> főcím,{" "}
            <code className="text-rose-bright">## </code> fejezetcím, a bekezdések között üres sor.
          </p>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={18}
            maxLength={60_000}
            spellCheck
            aria-label="A dokumentum szövege"
            className={`${fieldClass} mt-3 min-h-80 py-3 font-mono text-xs leading-relaxed`}
          />
          {body !== templateBody && (
            <button
              type="button"
              onClick={() => window.confirm("Visszaállítod a szöveget a sablon szerintire? A kézi módosításaid elvesznek.") && setBody(templateBody)}
              className={`${buttonClass("ghost", "sm")} mt-2`}
            >
              <RotateCcw size={14} aria-hidden /> Vissza a sablon szövegére
            </button>
          )}
        </details>

        <div className="pg-panel sticky bottom-4 space-y-3 rounded-3xl p-5">
          {missing.length > 0 ? (
            <p className="flex items-start gap-2 text-sm text-amber-200">
              <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {missing.length} adat hiányzik: {missing.map((key) => labels[key] ?? key).join(", ")}. Nyomtatásban kitöltendő vonalként jelenik meg.
              </span>
            </p>
          ) : (
            <p className="text-sm text-emerald-300">Minden adat ki van töltve.</p>
          )}
          <Feedback error={state.error} />
          <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
            {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Save size={17} aria-hidden />}
            {id ? "Módosítások mentése" : "Mentés és nyomtatási nézet"}
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-3 text-center text-xs font-semibold tracking-[0.2em] text-white/40 uppercase print:hidden">Élő előnézet</p>
        <HrDocPaper title={title} number={number} body={body} values={shown} labels={labels} signatures={signatures} />
      </div>
    </form>
  );
}

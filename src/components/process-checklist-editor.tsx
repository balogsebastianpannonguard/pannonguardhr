"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Feedback, Input, buttonClass, fieldClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { resetChecklist, saveChecklist } from "@/lib/actions/processes";
import type { FormState } from "@/lib/form";

type Step = { key: string; title: string; hint?: string; offsetDays: number; optional?: boolean };
type InputStep = Omit<Step, "key">;

let counter = 0;
const withKeys = (steps: InputStep[]): Step[] => steps.map((step) => ({ ...step, key: `s${counter++}` }));

export function ProcessChecklistEditor({
  kind,
  steps: initial,
  defaults,
  custom,
  referenceLabel,
}: {
  kind: string;
  steps: InputStep[];
  defaults: InputStep[];
  custom: boolean;
  referenceLabel: string;
}) {
  const [steps, setSteps] = useState(() => withKeys(initial));
  const [state, action, pending] = useActionState<FormState, FormData>(saveChecklist, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [resetting, startReset] = useTransition();
  const [resetState, setResetState] = useState<FormState>({});

  const update = (key: string, patch: Partial<Step>) => setSteps((list) => list.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  const move = (index: number, delta: number) =>
    setSteps((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const payload = JSON.stringify(steps.map(({ key: _key, ...step }) => (void _key, { ...step, hint: step.hint?.trim() || undefined })));

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="steps" value={payload} />
      <p className="text-sm text-white/55">
        A határidő eltolása a viszonyítási naphoz (<strong className="text-white/75">{referenceLabel.toLowerCase()}</strong>) képest értendő, napokban: a negatív szám előtte,
        a pozitív utána. A már elindított folyamatokat a módosítás nem érinti.
      </p>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.key} className="rounded-2xl border border-white/10 bg-white/3 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-right text-sm text-white/35 tabular-nums">{index + 1}.</span>
              <div className="min-w-0 flex-1 space-y-2">
                <Input value={step.title} maxLength={160} required onChange={(event) => update(step.key, { title: event.target.value })} aria-label="A lépés neve" />
                <textarea
                  value={step.hint ?? ""}
                  maxLength={600}
                  rows={2}
                  onChange={(event) => update(step.key, { hint: event.target.value })}
                  placeholder="Segítő megjegyzés (jogszabály, határidő, teendő) – nem kötelező"
                  aria-label="Segítő megjegyzés"
                  className={`${fieldClass} min-h-14 py-2 text-sm leading-relaxed`}
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2 text-white/60">
                    Határidő:
                    <Input
                      type="number"
                      min={-365}
                      max={365}
                      value={step.offsetDays}
                      onChange={(event) => update(step.key, { offsetDays: Math.trunc(Number(event.target.value) || 0) })}
                      className="h-9! w-20"
                    />
                    nap
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-white/60">
                    <input type="checkbox" checked={Boolean(step.optional)} onChange={(event) => update(step.key, { optional: event.target.checked })} className="size-4 accent-[#e8a796]" />
                    opcionális
                  </label>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Feljebb" className={buttonClass("ghost", "sm")}>
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button type="button" disabled={index === steps.length - 1} onClick={() => move(index, 1)} aria-label="Lejjebb" className={buttonClass("ghost", "sm")}>
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button type="button" onClick={() => setSteps((list) => list.filter((item) => item.key !== step.key))} aria-label="Törlés" className={buttonClass("ghost", "sm")}>
                  <Trash2 size={14} aria-hidden className="text-red-300" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setSteps((list) => [...list, ...withKeys([{ title: "", offsetDays: 0 }])])} className={buttonClass("secondary", "sm")}>
        <Plus size={14} aria-hidden /> Új lépés
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <button
          type="button"
          disabled={resetting || !custom}
          title={custom ? undefined : "Most is az alapértelmezett lista van érvényben."}
          onClick={() => {
            if (!window.confirm("Visszaállítod az alapértelmezett listát? A módosításaid elvesznek.")) return;
            startReset(async () => {
              const result = await resetChecklist(kind);
              setResetState(result);
              if (result.ok) setSteps(withKeys(defaults));
            });
          }}
          className={buttonClass("ghost", "sm")}
        >
          {resetting ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <RotateCcw size={14} aria-hidden />} Visszaállítás alapértelmezettre
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <Feedback error={state.error ?? resetState.error} message={state.ok ? state.message : resetState.message} />
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Save size={16} aria-hidden />} Lista mentése
          </button>
        </div>
      </div>
    </form>
  );
}

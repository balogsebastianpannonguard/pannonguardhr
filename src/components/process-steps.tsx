"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarClock, Check, CircleCheck, LoaderCircle, MessageSquare, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Feedback, Input, Label, Pill, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { addStep, closeProcess, removeStep, toggleStep, updateStep } from "@/lib/actions/processes";
import type { FormState } from "@/lib/form";

export type StepView = {
  id: string;
  title: string;
  hint?: string;
  optional?: boolean;
  dueDate?: string;
  dueLabel?: string;
  done: boolean;
  doneLabel?: string;
  comment?: string;
  commentLabel?: string;
  overdue: boolean;
};

export function ProcessSteps({ processId, steps, open, allDone }: { processId: string; steps: StepView[]; open: boolean; allDone: boolean }) {
  const [editing, setEditing] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  function run(id: string, task: () => Promise<FormState>) {
    setBusy(id);
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
      setBusy(undefined);
    });
  }

  return (
    <div className="space-y-4">
      {allDone && open && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/8 p-4">
          <p className="flex items-center gap-2 text-sm text-emerald-100">
            <CircleCheck size={18} aria-hidden /> Minden kötelező lépés kész. Lezárhatod a folyamatot.
          </p>
          <button type="button" disabled={pending} onClick={() => run("close", () => closeProcess(processId))} className={buttonClass("primary", "sm")}>
            {busy === "close" ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Check size={15} aria-hidden />}
            Lezárás
          </button>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`rounded-2xl border p-3 sm:p-4 ${
              step.overdue ? "border-red-400/30 bg-red-500/6" : step.done ? "border-white/6 bg-white/2" : "border-white/10 bg-white/4"
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={step.done}
                aria-label={step.done ? `${step.title} – visszanyitás` : `${step.title} – kész`}
                disabled={pending}
                onClick={() => run(step.id, () => toggleStep(processId, step.id, !step.done))}
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border transition ${
                  step.done ? "border-rose bg-rose text-ink-950" : "border-white/25 hover:border-rose/70"
                }`}
              >
                {busy === step.id ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : step.done && <Check size={15} aria-hidden strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`font-medium [overflow-wrap:anywhere] ${step.done ? "text-white/45 line-through decoration-white/30" : ""}`}>
                    <span className="text-white/35 tabular-nums">{index + 1}.</span> {step.title}
                  </span>
                  {step.optional && <Pill>opcionális</Pill>}
                  {step.overdue && <Pill tone="error">lejárt</Pill>}
                </div>
                {step.hint && !step.done && <p className="mt-1 text-xs leading-relaxed text-white/45">{step.hint}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                  {step.dueLabel && (
                    <span className={`inline-flex items-center gap-1 ${step.overdue ? "text-red-300" : ""}`}>
                      <CalendarClock size={12} aria-hidden /> {step.dueLabel}
                    </span>
                  )}
                  {step.doneLabel && (
                    <span className="inline-flex items-center gap-1 text-emerald-300/80">
                      <CircleCheck size={12} aria-hidden /> {step.doneLabel}
                    </span>
                  )}
                </div>
                {step.comment && editing !== step.id && (
                  <p className="mt-2 rounded-xl bg-white/4 px-3 py-2 text-sm whitespace-pre-wrap text-white/70">
                    <MessageSquare size={12} aria-hidden className="mr-1.5 inline text-rose" />
                    {step.comment}
                    {step.commentLabel && <span className="mt-1 block text-xs text-white/35">{step.commentLabel}</span>}
                  </p>
                )}
              </div>
              {editing !== step.id && (
                <button type="button" onClick={() => setEditing(step.id)} aria-label={`${step.title} szerkesztése`} className={buttonClass("ghost", "sm")}>
                  <Pencil size={14} aria-hidden />
                </button>
              )}
            </div>
            {editing === step.id && (
              <StepEditor
                processId={processId}
                step={step}
                onClose={() => setEditing(undefined)}
                onRemove={() => {
                  if (window.confirm(`Biztosan törlöd ezt a lépést?\n\n${step.title}`)) run(step.id, () => removeStep(processId, step.id));
                }}
              />
            )}
          </li>
        ))}
      </ol>
      {error && <Feedback error={error} />}
      <AddStep processId={processId} />
    </div>
  );
}

function StepEditor({ processId, step, onClose, onRemove }: { processId: string; step: StepView; onClose: () => void; onRemove: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateStep, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="mt-3 space-y-3 border-t border-white/8 pt-3">
      <input type="hidden" name="processId" value={processId} />
      <input type="hidden" name="stepId" value={step.id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Label label="Lépés">
          <Input name="title" required maxLength={160} defaultValue={step.title} />
        </Label>
        <Label label="Határidő">
          <Input name="dueDate" type="date" defaultValue={step.dueDate} />
        </Label>
      </div>
      <Label label="Megjegyzés">
        <Textarea name="comment" rows={2} maxLength={2000} defaultValue={step.comment} className="min-h-16" placeholder="Pl. a vizsgálat időpontja, ki intézi, mi hiányzik még" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onRemove} className={buttonClass("danger", "sm")}>
          <Trash2 size={14} aria-hidden /> Lépés törlése
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Feedback error={state.error} message={state.ok ? state.message : undefined} />
          <button type="button" onClick={onClose} className={buttonClass("secondary", "sm")}>
            <X size={14} aria-hidden /> Bezárás
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <Save size={14} aria-hidden />} Mentés
          </button>
        </div>
      </div>
    </form>
  );
}

function AddStep({ processId }: { processId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addStep, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="rounded-2xl border border-dashed border-white/12 p-3 sm:p-4">
      <input type="hidden" name="processId" value={processId} />
      <p className="mb-2 text-sm font-medium text-white/70">Egyedi lépés hozzáadása</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
        <Input name="title" required maxLength={160} placeholder="Pl. Fegyvertartási engedély másolata" aria-label="Lépés neve" />
        <Input name="dueDate" type="date" aria-label="Határidő" />
        <button type="submit" disabled={pending} className={buttonClass("secondary")}>
          {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <Plus size={16} aria-hidden />} Hozzáadás
        </button>
      </div>
      <Feedback error={state.error} />
    </form>
  );
}

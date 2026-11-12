"use client";

import { useActionState, useTransition } from "react";
import { CalendarRange, LoaderCircle, Save, Trash2 } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { deleteProcess, shiftReferenceDate, updateProcess } from "@/lib/actions/processes";
import type { FormState } from "@/lib/form";

export function ProcessSettings({
  process,
  statuses,
  referenceLabel,
}: {
  process: { id: string; status: string; dueDate?: string; responsible?: string; note?: string; referenceDate: string };
  statuses: Record<string, string>;
  referenceLabel: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProcess, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [shiftState, shiftAction, shifting] = useActionState<FormState, FormData>(shiftReferenceDate, {});
  const { ref: shiftRef, onSubmit: shiftSubmit } = useKeepForm(shiftAction, shiftState);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-6">
      <form ref={ref} onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="processId" value={process.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Label label="Állapot">
            <Select name="status" defaultValue={process.status}>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Lezárás határideje">
            <Input name="dueDate" type="date" defaultValue={process.dueDate} />
          </Label>
        </div>
        <Label label="Felelős">
          <Input name="responsible" maxLength={80} defaultValue={process.responsible} />
        </Label>
        <Label label="Megjegyzés">
          <Textarea name="note" rows={3} maxLength={2000} defaultValue={process.note} className="min-h-20" />
        </Label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Feedback error={state.error} message={state.ok ? state.message : undefined} />
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <Save size={14} aria-hidden />} Mentés
          </button>
        </div>
      </form>

      <form ref={shiftRef} onSubmit={shiftSubmit} className="space-y-2 border-t border-white/8 pt-5">
        <input type="hidden" name="processId" value={process.id} />
        <Label label={referenceLabel} hint="Ha módosítod, a még nyitott lépések határideje ugyanennyivel eltolódik.">
          <div className="flex gap-2">
            <Input name="referenceDate" type="date" required defaultValue={process.referenceDate} />
            <button type="submit" disabled={shifting} className={buttonClass("secondary")} aria-label="Határidők eltolása">
              {shifting ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <CalendarRange size={16} aria-hidden />}
            </button>
          </div>
        </Label>
        <Feedback error={shiftState.error} message={shiftState.ok ? shiftState.message : undefined} />
      </form>

      <div className="border-t border-white/8 pt-5">
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (window.confirm("Biztosan törlöd ezt a folyamatot az összes lépésével együtt? Ez nem vonható vissza.")) startDelete(async () => void (await deleteProcess(process.id)));
          }}
          className={buttonClass("danger", "sm")}
        >
          {deleting ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <Trash2 size={14} aria-hidden />} Folyamat törlése
        </button>
      </div>
    </div>
  );
}

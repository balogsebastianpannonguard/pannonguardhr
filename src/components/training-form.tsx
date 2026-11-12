"use client";

import { useActionState } from "react";
import { LoaderCircle, Plus, Save } from "lucide-react";
import { ParticipantPicker, type EmployeeOption } from "@/components/training-participant-picker";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { createTraining, updateTraining } from "@/lib/actions/trainings";
import type { FormState } from "@/lib/form";
import { TRAINING_TYPES, type TrainingRow } from "@/lib/trainings-meta";

/** Képzés felvétele vagy módosítása a résztvevők kiválasztásával. */
export function TrainingForm({ training, options }: { training?: TrainingRow; options: EmployeeOption[] }) {
  const edit = Boolean(training);
  const [state, action, pending] = useActionState<FormState, FormData>(edit ? updateTraining : createTraining, {});
  const { ref, onSubmit } = useKeepForm(action, state);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      {training && <input type="hidden" name="id" value={training.id} />}
      <Label label="A képzés neve">
        <Input name="name" required minLength={3} maxLength={160} defaultValue={training?.name} placeholder="Pl. Éves munkavédelmi oktatás 2026" />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Típus" className="sm:col-span-2">
          <Select name="type" defaultValue={training?.type ?? "munkavedelmi"}>
            {Object.entries(TRAINING_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Kezdés napja">
          <Input name="startDate" type="date" required defaultValue={training?.startDate} />
        </Label>
        <Label label="Befejezés napja" hint="Többnapos képzésnél.">
          <Input name="endDate" type="date" defaultValue={training?.endDate} />
        </Label>
        <Label label="Oktató / képző szerv">
          <Input name="trainer" maxLength={120} defaultValue={training?.trainer} placeholder="Nem kötelező" />
        </Label>
        <Label label="Helyszín">
          <Input name="location" maxLength={160} defaultValue={training?.location} placeholder="Nem kötelező" />
        </Label>
        <Label label="Érvényesség (hónap)" hint="Ebből számoljuk a tanúsítványok lejáratát. Üresen: nem jár le.">
          <Input name="validityMonths" type="number" min={0} max={240} step={1} inputMode="numeric" defaultValue={training?.validityMonths} placeholder="Pl. 12" />
        </Label>
        <Label label="Költség (Ft)">
          <Input name="cost" type="number" min={0} step={1} inputMode="numeric" defaultValue={training?.cost} placeholder="Nem kötelező" />
        </Label>
      </div>
      <Label label="Megjegyzés">
        <Textarea name="notes" rows={2} maxLength={3000} defaultValue={training?.notes} className="min-h-16" />
      </Label>
      <ParticipantPicker key={training?.updatedAt ?? "new"} options={options} defaultSelected={training?.participants.map((item) => item.employeeId)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : edit ? <Save size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
          {edit ? "Mentés" : "Képzés felvétele"}
        </button>
      </div>
    </form>
  );
}

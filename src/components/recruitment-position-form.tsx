"use client";

import { useActionState } from "react";
import { LoaderCircle, Plus, Save } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { createPosition, updatePosition } from "@/lib/actions/recruitment";
import type { FormState } from "@/lib/form";
import type { Position } from "@/lib/recruitment";
import { POSITION_STATUS } from "@/lib/recruitment-meta";

export function PositionForm({ position, employmentTypes }: { position?: Position; employmentTypes: [string, string][] }) {
  const edit = Boolean(position);
  const [state, action, pending] = useActionState<FormState, FormData>(edit ? updatePosition : createPosition, {});
  const { ref, onSubmit } = useKeepForm(action, state);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      {position && <input type="hidden" name="id" value={position.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Munkakör" className="sm:col-span-2">
          <Input name="title" required maxLength={120} defaultValue={position?.title} placeholder="Pl. Vagyonőr, Objektumvezető, Recepciós" />
        </Label>
        <Label label="Egység / objektum">
          <Input name="department" maxLength={120} defaultValue={position?.department} placeholder="Pl. Westend irodaház" />
        </Label>
        <Label label="Helyszín">
          <Input name="location" maxLength={120} defaultValue={position?.location} placeholder="Pl. Budapest XIII." />
        </Label>
        <Label label="Foglalkoztatás">
          <Select name="employmentType" defaultValue={position?.employmentType ?? "hatarozatlan"}>
            {employmentTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Munkarend">
          <Input name="schedule" maxLength={160} defaultValue={position?.schedule} placeholder="Pl. 12 órás műszak, nappal és éjszaka" />
        </Label>
        <Label label="Bérsáv" hint="Szövegesen, ahogy a hirdetésben megjelenhet.">
          <Input name="salary" maxLength={120} defaultValue={position?.salary} placeholder="Pl. bruttó 2 400–2 700 Ft/óra" />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label label="Létszám">
            <Input name="headcount" type="number" min={1} max={500} required defaultValue={position?.headcount ?? 1} />
          </Label>
          <Label label="Állapot">
            <Select name="status" defaultValue={position?.status ?? "nyitott"}>
              {Object.entries(POSITION_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
        </div>
      </div>
      <Label label="Elvárások" hint="Soronként egy, pl. érvényes vagyonőri igazolvány, büntetlen előélet.">
        <Textarea name="requirements" rows={4} maxLength={4000} defaultValue={position?.requirements} />
      </Label>
      <Label label="Előnyt jelent">
        <Textarea name="niceToHave" rows={3} maxLength={4000} defaultValue={position?.niceToHave} className="min-h-20" />
      </Label>
      <Label label="Amit kínálunk">
        <Textarea name="benefits" rows={3} maxLength={4000} defaultValue={position?.benefits} className="min-h-20" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : edit ? <Save size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
          {edit ? "Mentés" : "Álláshely létrehozása"}
        </button>
      </div>
    </form>
  );
}

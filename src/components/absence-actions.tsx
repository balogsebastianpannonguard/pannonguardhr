"use client";

import { useActionState, useState, useTransition } from "react";
import { LoaderCircle, Save, Sparkles, Trash2 } from "lucide-react";
import { Feedback, Input, Label, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { suggestAllowance } from "@/lib/absences-meta";
import { deleteAbsence, saveAllowance } from "@/lib/actions/absences";
import type { FormState } from "@/lib/form";

export function DeleteAbsenceButton({ id, back }: { id: string; back?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("danger", "sm")}
        onClick={() => {
          if (!window.confirm("Biztosan törlöd ezt a távollétet?")) return;
          start(async () => {
            const result = await deleteAbsence(id, back);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Törlés
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/**
 * Éves szabadságkeret egy dolgozónak. A javaslathoz a születési évet és a gyermekek számát itt, kézzel lehet megadni:
 * ezek nem kerülnek mentésre, és a titkosított dolgozói adatokat sem olvassuk.
 */
export function AllowanceForm({ employeeId, year, days, carryOver, note }: { employeeId: string; year: number; days?: number; carryOver?: number; note?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAllowance, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [value, setValue] = useState(days === undefined ? "" : String(days));
  const [birthYear, setBirthYear] = useState("");
  const [children, setChildren] = useState("");
  const [disabled, setDisabled] = useState("");
  const birth = Number(birthYear);
  const validBirth = /^\d{4}$/.test(birthYear) && birth > year - 80 && birth < year - 14;
  const suggestion = suggestAllowance({ birthYear: validBirth ? birth : undefined, year, children: Number(children) || 0, disabledChildren: Number(disabled) || 0 });

  return (
    <div className="space-y-5">
      <form ref={ref} onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="year" value={year} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Label label={`${year}. évi keret (nap)`} hint="Üresen hagyva a keret törlődik.">
            <Input name="days" type="number" min={0} max={60} step="0.5" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
          </Label>
          <Label label="Áthozott napok">
            <Input name="carryOver" type="number" min={0} max={60} step="0.5" inputMode="decimal" defaultValue={carryOver} placeholder="0" />
          </Label>
        </div>
        <Label label="Megjegyzés">
          <Input name="note" maxLength={200} defaultValue={note} placeholder="Pl. részarányos keret belépés miatt" />
        </Label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Feedback error={state.error} message={state.ok ? state.message : undefined} />
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />} Keret mentése
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} aria-hidden className="text-rose" /> Keretjavaslat (Mt. 116–118. §)
        </p>
        <p className="mt-1 text-xs text-white/45">A születési évet és a gyermekek számát csak a számoláshoz add meg, nem mentjük el.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Label label="Születési év">
            <Input type="number" inputMode="numeric" min={1940} max={2015} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} placeholder="ÉÉÉÉ" />
          </Label>
          <Label label="Gyermek (16 év alatt)">
            <Input type="number" inputMode="numeric" min={0} max={15} value={children} onChange={(event) => setChildren(event.target.value)} placeholder="0" />
          </Label>
          <Label label="Ebből fogyatékos">
            <Input type="number" inputMode="numeric" min={0} max={15} value={disabled} onChange={(event) => setDisabled(event.target.value)} placeholder="0" />
          </Label>
        </div>
        <p className="mt-3 text-sm text-white/70">
          20 alap + {suggestion.age} életkor szerinti + {suggestion.child} gyermek utáni = <strong className="text-rose-bright">{suggestion.total} nap</strong>
          {!validBirth && <span className="block text-xs text-white/40">Születési év nélkül az életkor szerinti pótszabadság 0.</span>}
        </p>
        <button type="button" onClick={() => setValue(String(suggestion.total))} className={`${buttonClass("secondary", "sm")} mt-3`}>
          Javaslat átvétele
        </button>
        <p className="mt-2 text-xs text-white/40">Tájékoztató számítás; a fiatal munkavállalói, apasági és egyéb pótszabadságot külön vedd figyelembe.</p>
      </div>
    </div>
  );
}

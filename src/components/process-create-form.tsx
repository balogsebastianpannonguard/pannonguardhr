"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, LogIn, LogOut, Play } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { createProcess } from "@/lib/actions/processes";
import type { FormState } from "@/lib/form";

export type EmployeeChoice = { id: string; name: string; position: string; status: string };

export function ProcessCreateForm({
  employees,
  selectedId,
  defaultKind,
  defaultResponsible,
  today,
  exitReasons,
  stepCounts,
}: {
  employees: EmployeeChoice[];
  selectedId?: string;
  defaultKind: "belepes" | "kilepes";
  defaultResponsible: string;
  today: string;
  exitReasons: Record<string, string>;
  stepCounts: { belepes: number; kilepes: number };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProcess, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [kind, setKind] = useState(defaultKind);
  const [recordExit, setRecordExit] = useState(false);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-white/70">Folyamat</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["belepes", "Belépés", LogIn],
              ["kilepes", "Kilépés", LogOut],
            ] as const
          ).map(([value, label, Icon]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                kind === value ? "border-rose/60 bg-rose/15 text-rose-bright" : "border-white/10 bg-white/4 text-white/65 hover:bg-white/8"
              }`}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <Icon size={16} aria-hidden /> {label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-white/40">{stepCounts[kind]} lépéses ellenőrzőlistával indul (a sablon a „Sablonok” oldalon szerkeszthető).</p>
      </fieldset>

      <Label label="Munkavállaló">
        <Select name="employeeId" required defaultValue={selectedId ?? ""}>
          <option value="" disabled>
            – válassz –
          </option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} · {employee.position}
              {employee.status === "kilepett" ? " (kilépett)" : ""}
            </option>
          ))}
        </Select>
      </Label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label label={kind === "belepes" ? "Munkába lépés napja" : "Megszűnés napja"} hint="A lépések határideje ehhez igazodik.">
          <Input name="referenceDate" type="date" required defaultValue={today} />
        </Label>
        <Label label="Lezárás határideje" hint="Üresen: az utolsó lépés határideje.">
          <Input name="dueDate" type="date" />
        </Label>
      </div>

      <Label label="Felelős">
        <Input name="responsible" maxLength={80} defaultValue={defaultResponsible} />
      </Label>

      {kind === "kilepes" && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/3 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="recordExit" checked={recordExit} onChange={(event) => setRecordExit(event.target.checked)} className="mt-0.5 size-4 accent-[#e8a796]" />
            <span>
              <span className="font-medium">A kilépést a munkavállaló adatlapján is rögzítem</span>
              <span className="mt-0.5 block text-xs text-white/45">Az állapota „Kilépett” lesz, a kilépés napja a megszűnés napja.</span>
            </span>
          </label>
          {recordExit && (
            <Label label="A kilépés oka">
              <Select name="exitReason" required defaultValue="">
                <option value="" disabled>
                  – válassz –
                </option>
                {Object.entries(exitReasons).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Label>
          )}
        </div>
      )}

      <Label label="Megjegyzés">
        <Textarea name="note" rows={2} maxLength={2000} className="min-h-16" placeholder="Nem kötelező" />
      </Label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <button type="submit" disabled={pending || employees.length === 0} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Play size={16} aria-hidden />}
          Folyamat indítása
        </button>
      </div>
    </form>
  );
}

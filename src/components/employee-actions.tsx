"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, LogOut, Trash2 } from "lucide-react";
import { Feedback, Input, Label, Select, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { deleteEmployee, recordExit } from "@/lib/actions/employees";
import { EXIT_REASONS } from "@/lib/employee-meta";
import type { FormState } from "@/lib/form";

/** Kilépés rögzítése: nap + ok, az állapot „Kilépett” lesz. */
export function EmployeeExitForm({ employeeId, today }: { employeeId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordExit, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={employeeId} />
      <Label label="Kilépés napja (utolsó munkanap)">
        <Input name="exitDate" type="date" required defaultValue={today} />
      </Label>
      <Label label="A munkaviszony megszűnésének oka">
        <Select name="exitReason" required defaultValue="">
          <option value="" disabled>
            Válassz…
          </option>
          {Object.entries(EXIT_REASONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Label>
      <Feedback error={state.error} message={state.ok ? state.message : undefined} />
      <button type="submit" disabled={pending} className={`${buttonClass("secondary")} w-full`}>
        {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <LogOut size={16} aria-hidden />} Kilépés rögzítése
      </button>
    </form>
  );
}

/** GDPR szerinti végleges törlés: a munkavállaló nevének beírásával kell megerősíteni. */
export function EmployeeDeleteForm({ employeeId, name }: { employeeId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(deleteEmployee, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const matches = typed.trim().replace(/\s+/g, " ").toLocaleLowerCase("hu") === name.trim().replace(/\s+/g, " ").toLocaleLowerCase("hu");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass("danger")} w-full`}>
        <Trash2 size={16} aria-hidden /> Végleges törlés
      </button>
    );
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-red-400/25 bg-red-500/5 p-4">
      <input type="hidden" name="id" value={employeeId} />
      <p className="text-sm text-red-100/85">
        A munkavállaló minden itt tárolt adata – a titkosított bér- és személyes adatokkal együtt – visszavonhatatlanul törlődik. A
        változásnaplóban csak a törlés ténye marad meg, személyes adat nélkül.
      </p>
      <Label label={`A megerősítéshez írd be a nevet: ${name}`}>
        <Input name="confirmName" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
      </Label>
      <Feedback error={state.error} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Mégse
        </button>
        <button type="submit" disabled={!matches || pending} className={`${buttonClass("danger", "sm")} flex-1`}>
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Végleges törlés
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Pencil, Save } from "lucide-react";
import { Feedback, buttonClass } from "@/components/ui";
import { EmployeeSecretFields } from "@/components/employee-secret-fields";
import { useKeepForm } from "@/components/use-keep-form";
import { revealEmployeeSecret, saveEmployeeSecret } from "@/lib/actions/employees";
import { SECRET_LABELS, formatDate, type EmployeeSecret } from "@/lib/employee-meta";
import type { FormState } from "@/lib/form";

const money = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });

function display(key: keyof EmployeeSecret, secret: EmployeeSecret) {
  const value = secret[key];
  if (value === undefined || value === "") return undefined;
  if (key === "salary") return `${money.format(Number(value))} Ft${secret.salaryType === "oraber" ? " / óra" : " / hó"}`;
  if (key === "birthDate") return formatDate(String(value));
  return String(value);
}

/**
 * Bér és személyes adatok: alapból rejtve. A megjelenítés szerverművelet, amely a változásnaplóba is bekerül
 * (`employee.secret.view`); az adat csak a böngésző memóriájában él, amíg az oldal nyitva van.
 */
export function EmployeeSecretPanel({ employeeId, hasSecret }: { employeeId: string; hasSecret: boolean }) {
  const [secret, setSecret] = useState<EmployeeSecret | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, startLoading] = useTransition();
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await saveEmployeeSecret(previous, formData);
    if (result.ok) {
      setSecret(null);
      setEditing(false);
    }
    return result;
  }, {});
  const { ref, onSubmit } = useKeepForm(action, state);

  function reveal(thenEdit = false) {
    setError(undefined);
    startLoading(async () => {
      const result = await revealEmployeeSecret(employeeId);
      if (result.error) setError(result.error);
      else {
        setSecret(result.secret ?? {});
        setEditing(thenEdit);
      }
    });
  }

  if (!secret) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 p-4">
          <LockKeyhole size={18} aria-hidden className="mt-0.5 shrink-0 text-rose" />
          <p className="text-sm text-white/60">
            {hasSecret
              ? "A bér, az azonosítók, a lakcím és a születési adatok titkosítva vannak. A megtekintést a változásnapló rögzíti."
              : "Még nincs rögzített bér vagy személyes adat. Ha felviszed, titkosítva tároljuk."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasSecret ? (
            <button type="button" onClick={() => reveal()} disabled={loading} className={buttonClass("secondary", "sm")}>
              {loading ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Eye size={15} aria-hidden />} Adatok megjelenítése
            </button>
          ) : (
            <button type="button" onClick={() => reveal(true)} disabled={loading} className={buttonClass("secondary", "sm")}>
              {loading ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Pencil size={15} aria-hidden />} Adatok felvitele
            </button>
          )}
        </div>
        <Feedback error={error} message={state.ok ? state.message : undefined} />
      </div>
    );
  }

  if (editing) {
    return (
      <form ref={ref} onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="id" value={employeeId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <EmployeeSecretFields secret={secret} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Feedback error={state.error} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={buttonClass("ghost", "sm")}>
              Mégse
            </button>
            <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
              {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />} Titkosított mentés
            </button>
          </div>
        </div>
      </form>
    );
  }

  const keys = (Object.keys(SECRET_LABELS) as (keyof EmployeeSecret)[]).filter((key) => key !== "salaryType");
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {keys.map((key) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-white/45">{SECRET_LABELS[key]}</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">{display(key, secret) ?? <span className="text-white/30">–</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSecret(null)} className={buttonClass("secondary", "sm")}>
          <EyeOff size={15} aria-hidden /> Elrejtés
        </button>
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
          <Pencil size={15} aria-hidden /> Szerkesztés
        </button>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Feedback, Input, Label, Pill, Select, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { removeQualification, saveQualification } from "@/lib/actions/employees";
import { QUALIFICATION_KINDS, expiryText, expiryTone, formatDate, type Qualification } from "@/lib/employee-meta";
import type { FormState } from "@/lib/form";

const daysUntil = (date: string, today: string) => Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

function QualificationForm({ employeeId, item, onDone }: { employeeId: string; item?: Qualification; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await saveQualification(previous, formData);
    if (result.ok) onDone?.();
    return result;
  }, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: !item });

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-white/8 bg-white/3 p-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      {item && <input type="hidden" name="qualificationId" value={item.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Típus">
          <Select name="kind" defaultValue={item?.kind ?? "kepesites"}>
            {Object.entries(QUALIFICATION_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Megnevezés">
          <Input name="name" required minLength={2} maxLength={160} defaultValue={item?.name} placeholder="Pl. Személy- és vagyonőr OKJ" />
        </Label>
        <Label label="Okmány- / bizonyítványszám">
          <Input name="number" maxLength={60} defaultValue={item?.number} placeholder="Nem kötelező" />
        </Label>
        <Label label="Megjegyzés">
          <Input name="note" maxLength={300} defaultValue={item?.note} placeholder="Nem kötelező" />
        </Label>
        <Label label="Kiállítás napja">
          <Input name="issuedAt" type="date" defaultValue={item?.issuedAt} />
        </Label>
        <Label label="Lejárat" hint="Ha megadod, a Lejáratok között figyeljük.">
          <Input name="expiresAt" type="date" defaultValue={item?.expiresAt} />
        </Label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok && !item ? state.message : undefined} />
        <div className="flex gap-2">
          {onDone && item && (
            <button type="button" onClick={onDone} className={buttonClass("ghost", "sm")}>
              Mégse
            </button>
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : item ? <Save size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
            {item ? "Mentés" : "Hozzáadás"}
          </button>
        </div>
      </div>
    </form>
  );
}

function QualificationItem({ employeeId, item, today, exited }: { employeeId: string; item: Qualification; today: string; exited: boolean }) {
  const [editing, setEditing] = useState(false);
  const [removing, startRemoving] = useTransition();
  const [error, setError] = useState<string>();

  if (editing) return <QualificationForm employeeId={employeeId} item={item} onDone={() => setEditing(false)} />;
  const days = item.expiresAt ? daysUntil(item.expiresAt, today) : undefined;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium [overflow-wrap:anywhere]">{item.name}</p>
          <Pill tone="muted">{QUALIFICATION_KINDS[item.kind]}</Pill>
          {days !== undefined && !exited && <Pill tone={expiryTone(days)}>{expiryText(days)}</Pill>}
        </div>
        <p className="mt-1 text-xs text-white/50">
          {[item.number && `Szám: ${item.number}`, item.issuedAt && `Kiállítva: ${formatDate(item.issuedAt)}`, item.expiresAt && `Lejár: ${formatDate(item.expiresAt)}`]
            .filter(Boolean)
            .join(" · ") || "Nincs megadott szám vagy dátum"}
        </p>
        {item.note && <p className="mt-1 text-xs text-white/40">{item.note}</p>}
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")} aria-label={`${item.name} szerkesztése`}>
          <Pencil size={15} aria-hidden />
        </button>
        <button
          type="button"
          disabled={removing}
          onClick={() => {
            if (!window.confirm(`Biztosan törlöd: ${item.name}?`)) return;
            startRemoving(async () => {
              const result = await removeQualification(employeeId, item.id);
              setError(result.error);
            });
          }}
          className={buttonClass("ghost", "sm")}
          aria-label={`${item.name} törlése`}
        >
          {removing ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden className="text-red-300" />}
        </button>
      </div>
    </li>
  );
}

export function EmployeeQualifications({ employeeId, items, today, exited = false }: { employeeId: string; items: Qualification[]; today: string; exited?: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-white/55">Még nincs rögzített végzettség, képesítés vagy jogosultság.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <QualificationItem key={item.id} employeeId={employeeId} item={item} today={today} exited={exited} />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="space-y-2">
          <QualificationForm employeeId={employeeId} />
          <button type="button" onClick={() => setAdding(false)} className={buttonClass("ghost", "sm")}>
            Bezárás
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={buttonClass("secondary", "sm")}>
          <Plus size={15} aria-hidden /> Új tétel
        </button>
      )}
    </div>
  );
}

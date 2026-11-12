"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Printer, Trash2 } from "lucide-react";
import { buttonClass, fieldClass } from "@/components/ui";
import { deleteTraining, setRepaymentStatus } from "@/lib/actions/trainings";
import { REPAYMENT_STATUS, type RepaymentStatus } from "@/lib/trainings-meta";

export function PrintButton({ label = "Nyomtatás" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Printer size={17} aria-hidden /> {label}
    </button>
  );
}

export function DeleteTrainingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("danger", "sm")}
        onClick={() => {
          if (!window.confirm("Biztosan törlöd a képzést a résztvevői adatokkal együtt? Ez nem vonható vissza.")) return;
          start(async () => {
            const result = await deleteTraining(id);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Képzés törlése
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/** Kilépő dolgozó tanulmányi szerződésének visszafizetési állapota (azonnali mentéssel). */
export function RepaymentSelect({ trainingId, employeeId, value }: { trainingId: string; employeeId: string; value?: RepaymentStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Visszafizetés állapota"
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(event) => {
          const status = event.target.value;
          start(async () => {
            const result = await setRepaymentStatus(trainingId, employeeId, status);
            setError(result.error);
          });
        }}
        className={`${fieldClass} h-9 max-w-60 px-2.5 text-sm [&>option]:bg-ink-900`}
      >
        {Object.entries(REPAYMENT_STATUS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {pending && <LoaderCircle size={15} aria-hidden className="animate-spin text-white/50" />}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}

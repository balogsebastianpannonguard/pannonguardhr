"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Feedback, Pill, buttonClass, fieldClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { saveTrainingResults } from "@/lib/actions/trainings";
import type { FormState } from "@/lib/form";
import { ATTENDANCE, EXAM_RESULTS, type TrainingRow } from "@/lib/trainings-meta";

const small = `${fieldClass} h-9 px-2.5 text-sm`;

const expiryLabel = (date: string, today: string) => {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return { text: date.replaceAll("-", ". ") + ".", tone: days < 0 ? ("error" as const) : days <= 90 ? ("warning" as const) : ("muted" as const) };
};

/** Résztvevőnkénti jelenlét, vizsga, tanúsítványszám és tanulmányi szerződés. */
export function TrainingResultsForm({ training, today }: { training: TrainingRow; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTrainingResults, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [contracts, setContracts] = useState(() => new Set(training.participants.filter((item) => item.studyContract).map((item) => item.employeeId)));

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={training.id} />
      <ul className="space-y-3">
        {training.participants.map((participant) => {
          const id = participant.employeeId;
          const expiry = participant.expiresAt ? expiryLabel(participant.expiresAt, today) : null;
          return (
            <li key={id} className="pg-card rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/kepzesek/dolgozo/${id}`} className="font-semibold hover:text-rose">
                    {participant.name}
                  </Link>
                  {participant.position && <p className="text-xs text-white/45">{participant.position}</p>}
                </div>
                {expiry && <Pill tone={expiry.tone}>Lejár: {expiry.text}</Pill>}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-xs text-white/50">Jelenlét</span>
                  <select name={`att_${id}`} defaultValue={participant.attendance} className={`${small} [&>option]:bg-ink-900`}>
                    {Object.entries(ATTENDANCE).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/50">Vizsga</span>
                  <select name={`exam_${id}`} defaultValue={participant.exam} className={`${small} [&>option]:bg-ink-900`}>
                    {Object.entries(EXAM_RESULTS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {value === "" ? "Nincs / nincs eredmény" : label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/50">Pontszám</span>
                  <input name={`score_${id}`} type="number" min={0} max={1000} step="0.5" inputMode="decimal" defaultValue={participant.score} className={small} placeholder="–" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/50">Tanúsítvány száma</span>
                  <input name={`cert_${id}`} maxLength={80} defaultValue={participant.certificateNumber} className={small} placeholder="–" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    name={`sc_${id}`}
                    defaultChecked={participant.studyContract}
                    onChange={(event) =>
                      setContracts((set) => {
                        const next = new Set(set);
                        if (event.target.checked) next.add(id);
                        else next.delete(id);
                        return next;
                      })
                    }
                    className="size-4 accent-rose"
                  />
                  Tanulmányi szerződés
                </label>
                {contracts.has(id) && (
                  <label className="flex items-center gap-2 text-sm text-white/60">
                    Összeg (Ft)
                    <input name={`scAmount_${id}`} type="number" min={0} step={1} inputMode="numeric" defaultValue={participant.studyAmount} className={`${small} w-36`} />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Save size={17} aria-hidden />}
          Eredmények mentése
        </button>
      </div>
    </form>
  );
}

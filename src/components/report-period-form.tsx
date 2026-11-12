"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Input, Select, buttonClass } from "@/components/ui";

const PERIOD_OPTIONS = [
  ["ev", "Idei év"],
  ["12ho", "Elmúlt 12 hónap"],
  ["elozo", "Előző év"],
  ["egyedi", "Egyedi időszak"],
] as const;

/** Időszakválasztó (GET-űrlap): egyedi időszaknál a kezdő és záró hónap is megadható. */
export function ReportPeriodForm({ action, period, from, to, max }: { action: string; period: string; from: string; to: string; max: string }) {
  const [key, setKey] = useState(period);
  return (
    <form method="get" action={action} className="print-hidden pg-panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
      <label className="min-w-44 flex-1">
        <span className="mb-1 block text-xs text-white/50">Időszak</span>
        <Select name="idoszak" value={key} onChange={(event) => setKey(event.target.value)}>
          {PERIOD_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      {key === "egyedi" && (
        <>
          <label className="min-w-36 flex-1">
            <span className="mb-1 block text-xs text-white/50">Kezdő hónap</span>
            <Input name="tol" type="month" defaultValue={from} max={max} required />
          </label>
          <label className="min-w-36 flex-1">
            <span className="mb-1 block text-xs text-white/50">Záró hónap</span>
            <Input name="ig" type="month" defaultValue={to} max={max} required />
          </label>
        </>
      )}
      <button type="submit" className={buttonClass("secondary")}>
        <CalendarRange size={16} aria-hidden /> Mutasd
      </button>
    </form>
  );
}

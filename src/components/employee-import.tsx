"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Copy, FileSearch, LoaderCircle, Upload } from "lucide-react";
import { Feedback, Pill, buttonClass } from "@/components/ui";
import { uploadTooBig, useKeepForm } from "@/components/use-keep-form";
import { importEmployees, type ImportState } from "@/lib/actions/employees";
import { formatDate } from "@/lib/employee-meta";

export function EmployeeImport() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importEmployees, {});
  const { ref, onSubmit, clientError } = useKeepForm(action, state, { check: uploadTooBig });
  const rows = state.imported ? [] : (state.rows ?? []);
  const good = rows.filter((row) => row.errors.length === 0 && !row.duplicate).length;
  const duplicates = rows.filter((row) => row.duplicate && row.errors.length === 0).length;
  const bad = rows.filter((row) => row.errors.length > 0).length;

  return (
    <div className="space-y-5">
      <form ref={ref} onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-white/70">CSV-fájl</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            required
            className="block w-full rounded-xl border border-dashed border-white/15 bg-white/3 p-4 text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-rose/20 file:px-3 file:py-2 file:font-semibold file:text-rose-bright"
          />
          <span className="mt-1 block text-xs text-white/40">
            Excelből: Fájl → Mentés másként → „CSV UTF-8 (pontosvesszővel tagolt)” vagy „CSV (pontosvesszővel tagolt)”. Legfeljebb 4 MB.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="mode" value="preview" disabled={pending} className={buttonClass("secondary")}>
            {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <FileSearch size={16} aria-hidden />} Előnézet
          </button>
          {good > 0 && (
            <button type="submit" name="mode" value="import" disabled={pending} className={buttonClass("primary")}>
              <Upload size={16} aria-hidden /> {good} munkavállaló importálása
            </button>
          )}
        </div>
        <Feedback error={clientError ?? state.error} message={state.imported ? state.message : undefined} />
        {state.imported ? (
          <Link href="/munkavallalok" className={buttonClass("primary", "sm")}>
            Tovább a munkavállalókhoz
          </Link>
        ) : null}
      </form>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pill tone="ok" icon={CircleCheck}>
              {good} importálható
            </Pill>
            {duplicates > 0 && (
              <Pill tone="muted" icon={Copy}>
                {duplicates} már szerepel – kihagyom
              </Pill>
            )}
            {bad > 0 && (
              <Pill tone="error" icon={CircleAlert}>
                {bad} hibás sor – kihagyom
              </Pill>
            )}
          </div>
          {state.known && (
            <p className="text-xs text-white/45">
              Felismert oszlopok: {state.known.length}.{state.ignored?.length ? ` Figyelmen kívül hagyva: ${state.ignored.join(", ")}.` : ""}
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-white/4 text-xs text-white/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Sor</th>
                  <th className="px-3 py-2 font-medium">Név</th>
                  <th className="px-3 py-2 font-medium">Munkakör</th>
                  <th className="px-3 py-2 font-medium">Egység</th>
                  <th className="px-3 py-2 font-medium">Belépés</th>
                  <th className="px-3 py-2 font-medium">Orvosi</th>
                  <th className="px-3 py-2 font-medium">Állapot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((row) => (
                  <tr key={row.line} className={row.errors.length ? "bg-red-500/5" : row.duplicate ? "opacity-60" : ""}>
                    <td className="px-3 py-2 text-white/45 tabular-nums">{row.line}.</td>
                    <td className="px-3 py-2 font-medium">{row.data.name ?? "–"}</td>
                    <td className="px-3 py-2 text-white/70">{row.data.position || "–"}</td>
                    <td className="px-3 py-2 text-white/70">{row.data.department ?? "–"}</td>
                    <td className="px-3 py-2 text-white/70">{formatDate(row.data.startDate)}</td>
                    <td className="px-3 py-2 text-white/70">{formatDate(row.data.medicalExpiry)}</td>
                    <td className="px-3 py-2">
                      {row.errors.length ? (
                        <ul className="space-y-0.5 text-xs text-red-200">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : row.duplicate ? (
                        <span className="text-xs text-white/55">{row.duplicate}</span>
                      ) : (
                        <span className="text-xs text-emerald-300">Rendben</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, FileSearch, LoaderCircle, RefreshCw, ShieldCheck, Upload, UserRoundPlus, UserX } from "lucide-react";
import { Feedback, Pill, buttonClass } from "@/components/ui";
import { uploadTooBig, useKeepForm } from "@/components/use-keep-form";
import { importAppsheet, type AppsheetState } from "@/lib/actions/appsheet";

const number = new Intl.NumberFormat("hu-HU");

export function AppsheetImport() {
  const [state, action, pending] = useActionState<AppsheetState, FormData>(importAppsheet, {});
  const { ref, onSubmit, clientError } = useKeepForm(action, state, { check: uploadTooBig });
  const [showAll, setShowAll] = useState(false);
  const summary = state.summary;
  const pendingChanges = summary ? summary.created + summary.updated : 0;
  const verified = summary?.verified;
  const verifiedOk = verified && verified.mismatches === 0 && verified.rows === summary.rows;

  return (
    <div className="space-y-6">
      <form ref={ref} onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-white/70">AppSheet-export (CSV)</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,text/plain"
            required
            className="block w-full rounded-xl border border-dashed border-white/15 bg-white/3 p-4 text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-rose/20 file:px-3 file:py-2 file:font-semibold file:text-rose-bright"
          />
          <span className="mt-1 block text-xs text-white/40">Az AppSheet „Export this view” fájlja, módosítás nélkül. Legfeljebb 4 MB.</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="mode" value="preview" disabled={pending} className={buttonClass("secondary")}>
            {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin" /> : <FileSearch size={16} aria-hidden />} Előnézet és ellenőrzés
          </button>
          {summary && !state.committed && (
            <button type="submit" name="mode" value="import" disabled={pending} className={buttonClass("primary")}>
              <Upload size={16} aria-hidden /> {pendingChanges ? `Betöltés (${number.format(pendingChanges)} munkatárs)` : "Betöltés (nincs változás – csak frissítem a sorrendet)"}
            </button>
          )}
        </div>
        <Feedback error={clientError ?? state.error} />
      </form>

      {summary && (
        <div className="space-y-5">
          {state.committed && verified && (
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${verifiedOk ? "border-emerald-300/25 bg-emerald-400/8 text-emerald-100" : "border-red-400/30 bg-red-500/10 text-red-100"}`}
            >
              {verifiedOk ? <ShieldCheck size={20} aria-hidden className="mt-0.5 shrink-0" /> : <CircleAlert size={20} aria-hidden className="mt-0.5 shrink-0" />}
              <div className="space-y-1">
                <p className="font-semibold">
                  {verifiedOk ? "Betöltve és visszaellenőrizve – minden cella betűre egyezik." : `Figyelem: ${number.format(verified.mismatches)} cella eltér a fájltól!`}
                </p>
                <p className="text-xs opacity-80">
                  Visszaolvasva és visszafejtve: {number.format(verified.rows)} sor, {number.format(verified.cells)} cella, eltérés: {number.format(verified.mismatches)}.{" "}
                  {verified.exactBytes ? "A rendszerből visszaállított fájl bájtra azonos a feltöltöttel." : "A visszaállított fájl formázása (idézőjelek, sorvégek) eltérhet, a cellák tartalma a fenti szerint."}
                </p>
                <Link href="/munkavallalok" className={`${buttonClass("primary", "sm")} mt-2`}>
                  Tovább a munkatársakhoz
                </Link>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Sor (munkatárs)", summary.rows],
              ["Oszlop", summary.columns],
              ["Cella", summary.cells],
              ["Cég", summary.companies.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-white/3 p-3">
                <dt className="text-xs text-white/45">{label}</dt>
                <dd className="font-display text-xl font-semibold">{number.format(Number(value))}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Pill tone="ok" icon={UserRoundPlus}>
              {number.format(summary.created)} új
            </Pill>
            <Pill tone="info" icon={RefreshCw}>
              {number.format(summary.updated)} változott
            </Pill>
            <Pill tone="muted" icon={CircleCheck}>
              {number.format(summary.unchanged)} változatlan
            </Pill>
            {summary.missing > 0 && (
              <Pill tone="warning" icon={UserX}>
                {number.format(summary.missing)} korábbi munkatárs nincs a fájlban
              </Pill>
            )}
            {summary.issueRows > 0 && (
              <Pill tone="warning" icon={CircleAlert}>
                {number.format(summary.issueRows)} sorban ellenőrizendő adat
              </Pill>
            )}
          </div>

          <ul className="space-y-1 text-sm text-white/60">
            {summary.companies.map(([company, count]) => (
              <li key={company}>
                {company}: <strong className="text-white/85">{number.format(count)}</strong> fő
              </li>
            ))}
          </ul>

          <p className="text-xs text-white/45">
            {summary.exactFormat ? "A fájl szerkezete (idézőjelek, sorvégek, BOM) pontosan felismerve – bájtra visszaállítható." : "A fájl formázása kicsit eltér a szokásos AppSheet-exporttól; a cellák tartalma ettől még pontosan betöltődik."}
            {summary.unknownHeaders.length > 0 && ` Nem várt oszlop(ok), amelyeket szintén megőrzök (titkosítva): ${summary.unknownHeaders.join(", ")}.`}
            {summary.missing > 0 && " A fájlból hiányzó korábbi munkatársakat nem törlöm, csak megjelölöm."}
          </p>

          {summary.changes.length > 0 && (
            <details className="rounded-2xl border border-white/8 bg-white/3 p-4 text-sm">
              <summary className="cursor-pointer font-medium">Változott munkatársak ({summary.changes.length})</summary>
              <ul className="mt-3 space-y-1.5">
                {summary.changes.map((change) => (
                  <li key={change.row} className="text-white/65">
                    <span className="text-white/40">{change.row}. sor · </span>
                    <strong className="text-white/85">{change.name}</strong> – {change.columns.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {summary.issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Ellenőrizendő adatok ({summary.issueCount})</h3>
              <p className="text-xs text-white/45">
                Ezeket nem javítottam ki: pontosan úgy töltöm be, ahogy az AppSheet-ben szerepelnek, de érdemes ott rendbe tenni őket.
              </p>
              <ul className="divide-y divide-white/6 rounded-2xl border border-white/8 bg-white/3 text-sm">
                {(showAll ? summary.issues : summary.issues.slice(0, 25)).map((item) => (
                  <li key={item.row} className="px-4 py-2.5">
                    <p>
                      <span className="text-white/40">{item.row}. sor · </span>
                      <strong>{item.name}</strong>
                    </p>
                    <ul className="mt-0.5 list-disc pl-5 text-xs text-amber-200/85">
                      {item.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {summary.issues.length > 25 && (
                <button type="button" onClick={() => setShowAll(!showAll)} className={buttonClass("ghost", "sm")}>
                  {showAll ? "Kevesebb" : `Mind a(z) ${summary.issues.length} sor mutatása`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

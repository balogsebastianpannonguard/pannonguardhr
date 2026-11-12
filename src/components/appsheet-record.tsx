"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { Feedback, buttonClass } from "@/components/ui";
import { revealAppsheetSecret } from "@/lib/actions/appsheet";
import { APPSHEET_COLUMNS, APPSHEET_GROUPS, type AppsheetGroup, type AppsheetView } from "@/lib/appsheet-meta";

const ORDER: AppsheetGroup[] = ["munkaviszony", "elerhetoseg", "szemelyes", "azonosito", "lakcim", "kepesites", "gyermek", "dokumentum", "appsheet"];

/**
 * Az AppSheet-adatlap minden oszlopa, betűre pontosan úgy, ahogy a fájlban szerepelt. A bizalmas cellák rejtve
 * vannak; a megjelenítés szerverművelet, amelyet a változásnapló rögzít.
 */
export function AppsheetRecord({ employeeId, record }: { employeeId: string; record: AppsheetView }) {
  const [secret, setSecret] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string>();
  const [loading, startLoading] = useTransition();

  function reveal() {
    setError(undefined);
    startLoading(async () => {
      const result = await revealAppsheetSecret(employeeId);
      if (result.error) setError(result.error);
      else setSecret(result.values ?? {});
    });
  }

  const extras = secret ? Object.entries(secret).filter(([key]) => key.startsWith("x:")) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/45">
          Forrás: {record.file}, {record.row}. sor · AppSheet-azonosító: {record.key.startsWith("azon:") ? "nincs (név és születési adatok alapján egyeztetve)" : record.key}
        </p>
        {record.hasSecret &&
          (secret ? (
            <button type="button" onClick={() => setSecret(null)} className={buttonClass("secondary", "sm")}>
              <EyeOff size={15} aria-hidden /> Bizalmas adatok elrejtése
            </button>
          ) : (
            <button type="button" onClick={reveal} disabled={loading} className={buttonClass("secondary", "sm")}>
              {loading ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Eye size={15} aria-hidden />} Bizalmas adatok megjelenítése
            </button>
          ))}
      </div>
      <Feedback error={error} />

      {ORDER.map((group) => {
        const columns = APPSHEET_COLUMNS.filter((column) => column.group === group);
        return (
          <section key={group}>
            <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-rose-bright/80 uppercase">{APPSHEET_GROUPS[group]}</h3>
            <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-white/6 bg-white/2 p-4 text-sm sm:grid-cols-2">
              {columns.map((column) => {
                const value = column.secret ? secret?.[column.id] : record.plain[column.id];
                const hidden = column.secret && !secret;
                return (
                  <div key={column.id} className={`min-w-0 ${column.multiline ? "sm:col-span-2" : ""}`}>
                    <dt className="flex items-center gap-1 text-xs text-white/45">
                      {column.secret && <LockKeyhole size={11} aria-label="bizalmas" className="text-rose/70" />}
                      {column.header}
                    </dt>
                    <dd className="font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {hidden ? <span className="tracking-widest text-white/30">••••••</span> : value ? value : <span className="text-white/25">–</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      {extras.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-rose-bright/80 uppercase">További oszlopok a fájlból</h3>
          <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-white/6 bg-white/2 p-4 text-sm sm:grid-cols-2">
            {extras.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs text-white/45">{Number(key.slice(2)) + 1}. oszlop</dt>
                <dd className="font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { ChartColumn, Download, Table2 } from "lucide-react";

export type Cell = string | number;
export type TableData = { columns: string[]; rows: Cell[][] };

const number = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 });

/** CSV magyar Excelhez: pontosvessző, tizedesvessző, UTF-8 BOM. */
export function toCsv({ columns, rows }: TableData) {
  const escape = (cell: Cell) => {
    // A szöveges cella nem kezdődhet képlettel (CSV-injekció ellen).
    const value = typeof cell === "number" ? String(cell).replace(".", ",") : /^[=+\-@\t]/.test(cell) ? `'${cell}` : cell;
    return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return `﻿${[columns, ...rows].map((row) => row.map(escape).join(";")).join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, table: TableData) {
  const blob = new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Diagram-kártya: diagram ↔ táblázat nézet és CSV-export. */
export function ReportChartCard({ title, note, filename, table, children, className = "" }: { title: string; note?: ReactNode; filename: string; table: TableData; children: ReactNode; className?: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const toggle = "grid size-8 place-items-center rounded-lg transition";
  return (
    <section className={`pg-panel min-w-0 rounded-3xl p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
          {note && <div className="mt-0.5 text-xs text-white/45">{note}</div>}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/8 p-0.5" role="group" aria-label={`${title} – nézet`}>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")} className={`${toggle} ${view === "chart" ? "bg-rose/20 text-rose-bright" : "text-white/50 hover:text-white"}`} title="Diagram">
            <ChartColumn size={15} aria-hidden />
            <span className="sr-only">Diagram</span>
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")} className={`${toggle} ${view === "table" ? "bg-rose/20 text-rose-bright" : "text-white/50 hover:text-white"}`} title="Táblázat">
            <Table2 size={15} aria-hidden />
            <span className="sr-only">Táblázat</span>
          </button>
          <button type="button" onClick={() => downloadCsv(filename, table)} className={`${toggle} text-white/50 hover:text-white`} title="Letöltés CSV-ben">
            <Download size={15} aria-hidden />
            <span className="sr-only">Letöltés CSV-ben</span>
          </button>
        </div>
      </div>
      {view === "chart" ? (
        children
      ) : (
        <div className="max-h-96 overflow-auto rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900">
              <tr>
                {table.columns.map((column, index) => (
                  <th key={column} scope="col" className={`px-3 py-2 text-xs font-medium text-white/55 ${index ? "text-right" : "text-left"}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-white/5">
                  {row.map((cell, index) => (
                    <td key={index} className={`px-3 py-1.5 ${index ? "text-right tabular-nums" : ""}`}>
                      {typeof cell === "number" ? number.format(cell) : cell}
                    </td>
                  ))}
                </tr>
              ))}
              {table.rows.length === 0 && (
                <tr>
                  <td colSpan={table.columns.length} className="px-3 py-6 text-center text-white/45">
                    Nincs adat az időszakban.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

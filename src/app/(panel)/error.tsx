"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bug, Home, RotateCcw, TriangleAlert } from "lucide-react";
import { PAJZSI_TICKET_EVENT, type PajzsiTicketDetail } from "@/components/pajzsi/pajzsi";

/** A panel oldalainak hibaoldala újrapróbálással és a hiba azonosítójával. */
export default function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pg-rise mx-auto max-w-xl py-10 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-500/12 text-red-300 ring-1 ring-red-400/30">
        <TriangleAlert size={30} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold">Valami elakadt ezen az oldalon</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        A műveletet nem sikerült befejezni. Az adataid biztonságban vannak; próbáld újra, és ha ismét előjön, szólj a fejlesztőnek a lenti
        azonosítóval.
      </p>
      {digest && (
        <p className="mt-3 text-xs text-white/40">
          Hibaazonosító: <span className="rounded-md bg-white/6 px-2 py-0.5 font-mono text-white/70">{digest}</span>
        </p>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="pg-button flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
          <RotateCcw size={16} aria-hidden /> Újrapróbálás
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<PajzsiTicketDetail>(PAJZSI_TICKET_EVENT, {
                detail: { text: "Hibaoldal jelent meg ezen az oldalon.", diagnostics: digest ? [`Hibaazonosító: ${digest}`] : [] },
              }),
            )
          }
          className="flex h-11 items-center gap-2 rounded-xl border border-rose/40 px-5 text-sm text-rose transition hover:bg-rose/10"
        >
          <Bug size={16} aria-hidden /> Jelentsd be Pajzsinak
        </button>
        <Link href="/" className="flex h-11 items-center gap-2 rounded-xl border border-white/12 px-5 text-sm text-white/70 transition hover:border-white/30 hover:text-white">
          <Home size={16} aria-hidden /> Áttekintés
        </Link>
      </div>
    </div>
  );
}

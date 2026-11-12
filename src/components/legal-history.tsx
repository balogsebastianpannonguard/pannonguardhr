import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, History, Search, X } from "lucide-react";
import { Empty, Panel, Pill } from "@/components/ui";
import { formatStamp } from "@/lib/dates";
import { LEGAL_KINDS, USEFUL_LAWS, type LegalRow } from "@/lib/legal-hr";

/** Az elmentett kérdések, ellenőrzések és összehasonlítások kereshető listája. */
export function LegalHistory({ rows, query, path, showKind = false }: { rows: LegalRow[]; query: string; path: string; showKind?: boolean }) {
  return (
    <Panel title="Előzmények" icon={History} className="print-hidden">
      <form action={path} className="mb-3 flex gap-2" role="search">
        <label className="pg-field flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
          <Search size={15} aria-hidden className="shrink-0 text-white/40" />
          <span className="sr-only">Keresés az előzményekben</span>
          <input name="q" defaultValue={query} placeholder="Keresés…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
        </label>
        {query && (
          <Link href={path} aria-label="Keresés törlése" className="grid size-10 shrink-0 place-items-center rounded-xl text-white/50 hover:bg-white/6 hover:text-white">
            <X size={16} aria-hidden />
          </Link>
        )}
      </form>
      {rows.length === 0 ? (
        <Empty
          icon={History}
          title={query ? "Nincs találat" : "Még üres"}
          text={query ? "Próbálj más kifejezést." : "Az elkészült válaszok és elemzések titkosítva ide kerülnek."}
        />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/jog/${row.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere]">{row.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
                    {showKind && <span>{LEGAL_KINDS[row.kind]}</span>}
                    <span>{formatStamp(row.createdAt)}</span>
                    {row.high ? <Pill tone="error">{row.high} magas</Pill> : null}
                  </p>
                </div>
                <ArrowRight size={15} aria-hidden className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-rose" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function UsefulLaws() {
  return (
    <Panel title="Hasznos jogszabályok" icon={BookOpen} className="print-hidden">
      <ul className="space-y-2">
        {USEFUL_LAWS.map((law) => (
          <li key={law.url}>
            <a
              href={law.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-3 rounded-xl border border-white/8 bg-white/2 p-3 transition hover:border-rose/30 hover:bg-white/5"
            >
              <span className="grid h-8 min-w-12 shrink-0 place-items-center rounded-lg bg-rose/15 px-2 text-xs font-bold text-rose">{law.short}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{law.name}</span>
                  <ExternalLink size={13} aria-hidden className="shrink-0 text-white/35 group-hover:text-rose" />
                </span>
                <span className="mt-0.5 block text-xs text-white/50">{law.text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-white/40">A hatályos szöveget mindig a Nemzeti Jogszabálytárban (njt.hu) ellenőrizd.</p>
    </Panel>
  );
}

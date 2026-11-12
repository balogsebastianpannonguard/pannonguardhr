"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { fieldClass } from "@/components/ui";

export type EmployeeOption = { id: string; name: string; position: string; department?: string; status: string };

/**
 * Résztvevők kiválasztása kereséssel: a kijelöltek rejtett `participant` mezőként kerülnek az űrlapba. A kilépett
 * dolgozók csak akkor látszanak, ha már résztvevők voltak.
 */
export function ParticipantPicker({ options, defaultSelected = [], name = "participant" }: { options: EmployeeOption[]; defaultSelected?: string[]; name?: string }) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const chosen = new Set(selected);
  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("hu");
    return options.filter(
      (option) =>
        (option.status !== "kilepett" || defaultSelected.includes(option.id)) &&
        (!q || `${option.name} ${option.position} ${option.department ?? ""}`.toLocaleLowerCase("hu").includes(q)),
    );
  }, [options, query, defaultSelected]);

  const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  const allVisibleChosen = visible.length > 0 && visible.every((option) => chosen.has(option.id));
  const toggleVisible = () =>
    setSelected((list) =>
      allVisibleChosen ? list.filter((id) => !visible.some((option) => option.id === id)) : [...new Set([...list, ...visible.map((option) => option.id)])],
    );

  return (
    <div className="space-y-3">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/70">
          Résztvevők <span className="text-white/45">({selected.length} kiválasztva)</span>
        </p>
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="text-xs text-white/50 hover:text-white">
            Kijelölés törlése
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto" aria-label="Kiválasztott résztvevők">
          {selected.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1 rounded-full bg-rose/15 px-2.5 py-1 text-xs text-rose-bright ring-1 ring-rose/25 hover:bg-rose/25"
                aria-label={`${byId.get(id)?.name ?? "Ismeretlen"} eltávolítása`}
              >
                {byId.get(id)?.name ?? "Ismeretlen dolgozó"} <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={`${fieldClass} flex h-11 items-center gap-2`}>
        <Search size={16} aria-hidden className="shrink-0 text-white/40" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Keresés név, munkakör vagy egység szerint"
          aria-label="Dolgozó keresése"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-white/25"
          onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        />
      </div>
      <div className="rounded-xl border border-white/8">
        <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-xs text-white/50">
          <span>{visible.length} dolgozó</span>
          {visible.length > 0 && (
            <button type="button" onClick={toggleVisible} className="font-medium text-rose hover:text-rose-bright">
              {allVisibleChosen ? "Listázottak kijelölésének törlése" : "Listázottak kijelölése"}
            </button>
          )}
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-white/45">Nincs találat.</li>}
          {visible.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/5">
                <input type="checkbox" checked={chosen.has(option.id)} onChange={() => toggle(option.id)} className="size-4 accent-rose" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{option.name}</span>
                  <span className="block truncate text-xs text-white/45">
                    {[option.position, option.department].filter(Boolean).join(" · ")}
                    {option.status === "kilepett" && " · kilépett"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

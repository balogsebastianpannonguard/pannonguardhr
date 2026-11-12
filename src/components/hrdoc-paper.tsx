import Image from "next/image";
import type { ReactNode } from "react";

/*
 * A HR-dokumentumok közös (szerveren és kliensen is futó) kitöltő- és megjelenítő-logikája.
 * Sablonnyelv: `# Cím` (középre zárt főcím, a blokk további sorai alcímek), `## Fejezet`, üres sorral elválasztott
 * bekezdések, `{{kulcs}}` helyőrzők. A hiányzó adat jól látható üres helyként jelenik meg (nyomtatásban pontozott vonal).
 */

export type FieldType = "text" | "textarea" | "date" | "number";
export type TemplateField = { key: string; label: string; type: FieldType; default?: string; hint?: string };
export type Signature = "munkaltato" | "munkavallalo" | "atvetel";

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

const longDate = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
/** ÉÉÉÉ-HH-NN → „2026. november 12.” (más szöveget változatlanul hagy). */
export function longDay(value?: string) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? longDate.format(new Date(`${value}T12:00:00Z`)) : value;
}

/** A dátum típusú mezőket olvasható alakra hozza; az üres értékeket kihagyja. */
export function displayValues(values: Record<string, string>, fields: TemplateField[]) {
  const dates = new Set(fields.filter((field) => field.type === "date").map((field) => field.key));
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, dates.has(key) ? longDay(value.trim()) : value.trim()] as const)
      .filter(([, value]) => value !== ""),
  );
}

/** A helyőrzők behelyettesítése (a mezőértékekben lévő helyőrzőket is feloldja, legfeljebb három szinten). */
export function fillText(text: string, values: Record<string, string>) {
  let result = text;
  for (let round = 0; round < 3; round++) {
    const next = result.replace(PLACEHOLDER, (match, key: string, offset: number, whole: string) => {
      const value = values[key];
      if (value === undefined) return match;
      // A magyar dátum ponttal végződik („2026. november 12.”): ha a sablonban is pont követi, ne legyen dupla.
      return value.endsWith(".") && whole[offset + match.length] === "." ? value.slice(0, -1) : value;
    });
    if (next === result) break;
    result = next;
  }
  return result;
}

/** A kitöltetlenül maradt helyőrzők kulcsai. */
export const missingKeys = (text: string) => [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))];

function inline(text: string, labels: Record<string, string>): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const label = labels[match[1]] ?? match[1];
    parts.push(
      <span key={`${match.index}-${match[1]}`} className="whitespace-nowrap">
        <span className="rounded bg-amber-100 px-1 text-[0.85em] font-semibold text-amber-900 ring-1 ring-amber-400 print:hidden">[{label}]</span>
        <span className="hidden tracking-widest print:inline">……………………</span>
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function HrDocBody({ text, labels }: { text: string; labels: Record<string, string> }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^\n+|\s+$/g, ""))
    .filter(Boolean);
  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed print:text-[10.5pt]">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) {
          const [title, ...rest] = block.slice(2).split("\n");
          return (
            <div key={index} className="pt-1 pb-2 text-center break-after-avoid">
              <h2 className="text-xl font-bold tracking-wide uppercase">{inline(title, labels)}</h2>
              {rest.map((line, lineIndex) => (
                <p key={lineIndex} className="mt-0.5 text-sm">
                  {inline(line, labels)}
                </p>
              ))}
            </div>
          );
        }
        if (block.startsWith("## ")) {
          const [title, ...rest] = block.slice(3).split("\n");
          return (
            <div key={index} className="pt-2">
              <h3 className="font-bold break-after-avoid">{inline(title, labels)}</h3>
              {rest.length > 0 && <p className="mt-1 text-justify whitespace-pre-line">{inline(rest.join("\n"), labels)}</p>}
            </div>
          );
        }
        return (
          <p key={index} className="text-justify whitespace-pre-line">
            {inline(block, labels)}
          </p>
        );
      })}
    </div>
  );
}

const SIGNATURE_TEXT: Record<Signature, { title: string; lines: string[] }> = {
  munkaltato: { title: "{{munkaltato}}", lines: ["munkáltató", "képviseli: {{munkaltato_kepviselo}}"] },
  munkavallalo: { title: "{{nev}}", lines: ["munkavállaló"] },
  atvetel: { title: "{{nev}}", lines: ["munkavállaló – átvettem, napja: ……………………"] },
};

export function HrDocPaper({
  title,
  number,
  body,
  values,
  labels,
  signatures,
}: {
  title: string;
  number?: string;
  /** A sablonszöveg (helyőrzőkkel); a kitöltés itt történik. */
  body: string;
  /** Megjelenítésre kész értékek (lásd `displayValues`). */
  values: Record<string, string>;
  labels: Record<string, string>;
  signatures: Signature[];
}) {
  return (
    <article
      aria-label={title}
      className="mx-auto w-full max-w-[52rem] rounded-2xl bg-white px-6 py-8 font-serif text-[#14182b] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] sm:px-14 sm:py-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
    >
      {/* Nem <header>: a nyomtatási stíluslap minden header elemet elrejt. */}
      <div className="flex items-center justify-between gap-4 border-b-2 border-[#14182b] pb-3 font-sans">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo.png" alt="PannonGuard" width={878} height={1080} className="h-auto w-9 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold [overflow-wrap:anywhere]">PannonGuard Biztonsági Szolgáltató Zrt.</p>
            <p className="text-xs text-[#4b5563]">4026 Debrecen, Hatvan utca 39. II/3.</p>
          </div>
        </div>
        {number && <p className="shrink-0 text-right text-xs text-[#4b5563]">Iktatószám: {number}</p>}
      </div>

      <div className="mt-6">
        <HrDocBody text={fillText(body, values)} labels={labels} />
      </div>

      {signatures.length > 0 && (
        <div className={`mt-14 grid gap-x-10 gap-y-12 break-inside-avoid ${signatures.length > 1 ? "sm:grid-cols-2 print:grid-cols-2" : "sm:ml-auto sm:w-1/2 print:ml-auto print:w-1/2"}`}>
          {signatures.map((signature) => (
            <div key={signature} className="text-center text-sm">
              <div className="border-t border-[#14182b] pt-1.5 font-semibold">{inline(fillText(SIGNATURE_TEXT[signature].title, values), labels)}</div>
              {SIGNATURE_TEXT[signature].lines.map((line) => (
                <p key={line} className="text-[#4b5563]">
                  {inline(fillText(line, values), labels)}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

import { Minus, Plus } from "lucide-react";

/**
 * Determinisztikus bekezdésszintű különbségnézet (LCS), a módosított bekezdéseken belül szószintű kiemeléssel.
 * Tisztán számol, nincs benne AI: amit itt látsz, az ténylegesen eltér a két szövegben.
 */
type Op = { type: "same" | "add" | "del"; value: string };

const MAX_CELLS = 4_000_000;

export function diffSequence(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const out: Op[] = a.slice(0, start).map((value) => ({ type: "same", value }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  if (n * m > MAX_CELLS) {
    // Túl nagy eltérés: a középső rész egészében törölt + új (ritka, nagyon hosszú, teljesen átírt szövegnél).
    out.push(...midA.map((value) => ({ type: "del" as const, value })), ...midB.map((value) => ({ type: "add" as const, value })));
  } else {
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = midA[i] === midB[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        out.push({ type: "same", value: midA[i] });
        i++;
        j++;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        out.push({ type: "del", value: midA[i++] });
      } else {
        out.push({ type: "add", value: midB[j++] });
      }
    }
    while (i < n) out.push({ type: "del", value: midA[i++] });
    while (j < m) out.push({ type: "add", value: midB[j++] });
  }
  out.push(...a.slice(endA).map((value) => ({ type: "same" as const, value })));
  return out;
}

/** Bekezdések: üres sorok és az OCR oldaljelzői nélkül, egységes szóközökkel. */
export function paragraphs(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/^-{3}\s*\[\d+\. oldal\]\s*-{3}$/.test(line));
}

type Row =
  | { type: "same"; value: string }
  | { type: "add" | "del"; value: string }
  | { type: "change"; before: Op[]; after: Op[] }
  | { type: "skip"; count: number };

function words(line: string) {
  return line.split(/(\s+)/).filter(Boolean);
}

/** A törölt + új bekezdéspárokból szószintű „módosítás” lesz, ha elég hasonlók. */
function pairUp(ops: Op[]): Row[] {
  const rows: Row[] = [];
  let index = 0;
  while (index < ops.length) {
    if (ops[index].type === "same") {
      rows.push(ops[index++] as Row);
      continue;
    }
    const dels: string[] = [];
    const adds: string[] = [];
    while (index < ops.length && ops[index].type !== "same") {
      (ops[index].type === "del" ? dels : adds).push(ops[index].value);
      index++;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let k = 0; k < pairs; k++) {
      const a = words(dels[k]);
      const b = words(adds[k]);
      const diff = a.length * b.length <= 250_000 ? diffSequence(a, b) : null;
      const common = diff ? diff.filter((op) => op.type === "same" && op.value.trim()).length : 0;
      const longest = Math.max(a.filter((w) => w.trim()).length, b.filter((w) => w.trim()).length);
      if (diff && common / Math.max(longest, 1) >= 0.35) {
        rows.push({ type: "change", before: diff.filter((op) => op.type !== "add"), after: diff.filter((op) => op.type !== "del") });
      } else {
        rows.push({ type: "del", value: dels[k] }, { type: "add", value: adds[k] });
      }
    }
    for (const value of dels.slice(pairs)) rows.push({ type: "del", value });
    for (const value of adds.slice(pairs)) rows.push({ type: "add", value });
  }
  return rows;
}

/** A hosszú változatlan szakaszokat összecsukja, a változások körül 2-2 bekezdés környezetet hagy. */
function collapse(rows: Row[], context = 2): Row[] {
  const out: Row[] = [];
  let index = 0;
  while (index < rows.length) {
    if (rows[index].type !== "same") {
      out.push(rows[index++]);
      continue;
    }
    let end = index;
    while (end < rows.length && rows[end].type === "same") end++;
    const run = rows.slice(index, end);
    const head = index === 0 ? 0 : context;
    const tail = end === rows.length ? 0 : context;
    if (run.length > head + tail + 1) {
      out.push(...run.slice(0, head), { type: "skip", count: run.length - head - tail }, ...run.slice(run.length - tail));
    } else {
      out.push(...run);
    }
    index = end;
  }
  return out;
}

export function diffStats(before: string, after: string) {
  const rows = pairUp(diffSequence(paragraphs(before), paragraphs(after)));
  return {
    rows,
    added: rows.filter((row) => row.type === "add").length,
    removed: rows.filter((row) => row.type === "del").length,
    changed: rows.filter((row) => row.type === "change").length,
    same: rows.filter((row) => row.type === "same").length,
  };
}

function Tokens({ ops, mark }: { ops: Op[]; mark: string }) {
  return (
    <>
      {ops.map((op, index) =>
        op.type === "same" ? (
          <span key={index}>{op.value}</span>
        ) : (
          <mark key={index} className={`rounded px-0.5 text-inherit ${mark}`}>
            {op.value}
          </mark>
        ),
      )}
    </>
  );
}

const DEL = "border-red-400/60 bg-red-500/10 text-red-50";
const ADD = "border-emerald-400/60 bg-emerald-400/10 text-emerald-50";

export function LegalDiff({ before, after, titleA, titleB }: { before: string; after: string; titleA: string; titleB: string }) {
  const { rows, added, removed, changed, same } = diffStats(before, after);
  const visible = collapse(rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5 text-red-200">
          <Minus size={14} aria-hidden /> {removed} törölt
        </span>
        <span className="flex items-center gap-1.5 text-emerald-200">
          <Plus size={14} aria-hidden /> {added} új
        </span>
        <span className="text-amber-200">{changed} módosított</span>
        <span className="text-white/45">{same} változatlan bekezdés</span>
      </div>
      <p className="text-xs text-white/45">
        Piros: csak a(z) „{titleA}” szövegében szerepel. Zöld: csak a(z) „{titleB}” szövegében. A módosított bekezdésekben a
        kiemelt szavak változtak.
      </p>
      {added + removed + changed === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/3 p-4 text-sm text-white/60">
          A két változat bekezdései megegyeznek (csak sortörés vagy szóköz tér el).
        </p>
      ) : (
        <ol className="space-y-1.5 text-sm leading-relaxed [overflow-wrap:anywhere]">
          {visible.map((row, index) => {
            if (row.type === "skip")
              return (
                <li key={index} className="py-1 text-center text-xs text-white/35">
                  · · · {row.count} változatlan bekezdés · · ·
                </li>
              );
            if (row.type === "same")
              return (
                <li key={index} className="border-l-2 border-transparent px-3 py-1 text-white/50">
                  {row.value}
                </li>
              );
            if (row.type === "change")
              return (
                <li key={index} className="space-y-1">
                  <p className={`rounded-r-lg border-l-2 px-3 py-1.5 ${DEL}`}>
                    <span className="sr-only">Régi: </span>
                    <Tokens ops={row.before} mark="bg-red-500/35 line-through decoration-red-200/60" />
                  </p>
                  <p className={`rounded-r-lg border-l-2 px-3 py-1.5 ${ADD}`}>
                    <span className="sr-only">Új: </span>
                    <Tokens ops={row.after} mark="bg-emerald-400/30" />
                  </p>
                </li>
              );
            return (
              <li key={index} className={`flex gap-2 rounded-r-lg border-l-2 px-3 py-1.5 ${row.type === "del" ? DEL : ADD}`}>
                <span aria-hidden className="shrink-0 font-semibold opacity-60">
                  {row.type === "del" ? "−" : "+"}
                </span>
                <span className="sr-only">{row.type === "del" ? "Törölt: " : "Új: "}</span>
                <span className="min-w-0">{row.value}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

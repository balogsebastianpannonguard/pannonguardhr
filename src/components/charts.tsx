import type { ReactNode } from "react";

/**
 * Saját, tiszta SVG-diagramok (szerver- és kliensoldalon is renderelhetők, hook nélkül). Minden diagram `role="img"`
 * és teljes szöveges összefoglalót kap (`aria-label`), a jelmagyarázat HTML, így mobilon is olvasható. A „light” téma
 * a nyomtatható (fehér hátterű) riporthoz való.
 */

export type ChartTheme = "dark" | "light";
export type Series = { name: string; values: number[]; color?: string };
export type Slice = { label: string; value: number; color?: string };

const THEMES = {
  dark: {
    text: "rgba(255,255,255,0.72)",
    muted: "rgba(255,255,255,0.42)",
    grid: "rgba(255,255,255,0.07)",
    axis: "rgba(255,255,255,0.22)",
    gap: "#0b0f22",
    palette: ["#e8a796", "#e9679b", "#8fa2ff", "#f7a8c8", "#f8d4c6", "#c97b6a", "#5d6fd6", "#b84a78"],
  },
  light: {
    text: "#1f2937",
    muted: "#6b7280",
    grid: "#e5e7eb",
    axis: "#9ca3af",
    gap: "#ffffff",
    palette: ["#c9806d", "#d14d84", "#5d6fd6", "#e48bb0", "#a0614f", "#8fa2ff", "#9c3a66", "#e8a796"],
  },
} as const;

export const chartColor = (index: number, theme: ChartTheme = "dark") => THEMES[theme].palette[index % THEMES[theme].palette.length];

export const formatValue = (value: number, digits = 1) => new Intl.NumberFormat("hu-HU", { maximumFractionDigits: digits }).format(value);
const clip = (label: string, max: number) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);

function niceTicks(max: number, count = 4) {
  const hi = Math.max(1, max);
  const raw = hi / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const frac = raw / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  // Egész értékeknél (fő, darab) nincs tört osztás a tengelyen.
  const unit = step < 1 && Number.isInteger(max) ? 1 : step;
  const ticks: number[] = [];
  for (let value = 0; value <= Math.ceil(hi / unit) * unit + unit / 2; value += unit) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

function Frame({ label, summary, children, legend, height, empty }: { label: string; summary: string; children: ReactNode; legend?: ReactNode; height: number; empty?: boolean }) {
  if (empty)
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-current/15 py-10 text-sm opacity-60" role="img" aria-label={`${label}: nincs adat az időszakban.`}>
        Nincs adat az időszakban.
      </div>
    );
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${label}. ${summary}`} className="h-auto w-full overflow-visible" style={{ fontFamily: "inherit" }}>
        <title>{label}</title>
        {children}
      </svg>
      {legend}
    </figure>
  );
}

function Legend({ items, theme }: { items: { name: string; color: string }[]; theme: ChartTheme }) {
  if (items.length < 2) return null;
  return (
    <ul className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs ${theme === "light" ? "text-[#4b5563]" : "text-white/60"}`}>
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

const W = 560;

/** Közös tengely-rajzoló az oszlop- és vonaldiagramhoz. */
function Axes({ labels, ticks, y, ml, mr, mt, ph, band, theme }: { labels: string[]; ticks: number[]; y: (value: number) => number; ml: number; mr: number; mt: number; ph: number; band: number; theme: ChartTheme }) {
  const t = THEMES[theme];
  const every = Math.ceil(labels.length / 12);
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={ml} x2={W - mr} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? t.axis : t.grid} />
          <text x={ml - 6} y={y(tick) + 3.5} textAnchor="end" fontSize="10" fill={t.muted}>
            {formatValue(tick)}
          </text>
        </g>
      ))}
      {labels.map((label, index) =>
        index % every === 0 ? (
          <text key={index} x={ml + band * index + band / 2} y={mt + ph + 15} textAnchor="middle" fontSize="10" fill={t.text}>
            {clip(label, 9)}
          </text>
        ) : null,
      )}
    </>
  );
}

const describeSeries = (labels: string[], series: Series[]) =>
  series.map((item) => `${item.name}: ${labels.map((label, index) => `${label} ${formatValue(item.values[index] ?? 0)}`).join(", ")}`).join(". ");

/** Vonaldiagram egy vagy több idősorral (pl. havi létszám). */
export function LineChart({ label, labels, series, theme = "dark", height = 220 }: { label: string; labels: string[]; series: Series[]; theme?: ChartTheme; height?: number }) {
  const t = THEMES[theme];
  const ml = 38;
  const mr = 12;
  const mt = 14;
  const mb = 26;
  const ph = height - mt - mb;
  const max = Math.max(0, ...series.flatMap((item) => item.values));
  const ticks = niceTicks(max);
  const hi = ticks[ticks.length - 1] || 1;
  const y = (value: number) => mt + ph - (value / hi) * ph;
  const band = (W - ml - mr) / Math.max(1, labels.length);
  const colored = series.map((item, index) => ({ ...item, color: item.color ?? chartColor(index, theme) }));
  return (
    <Frame label={label} summary={describeSeries(labels, series)} height={height} empty={!labels.length} legend={<Legend items={colored} theme={theme} />}>
      <Axes labels={labels} ticks={ticks} y={y} ml={ml} mr={mr} mt={mt} ph={ph} band={band} theme={theme} />
      {colored.map((item) => {
        const points = item.values.map((value, index) => [ml + band * index + band / 2, y(value)] as const);
        return (
          <g key={item.name}>
            {colored.length === 1 && points.length > 1 && (
              <path d={`M${points[0][0]},${y(0)} ${points.map(([x, py]) => `L${x},${py}`).join(" ")} L${points[points.length - 1][0]},${y(0)} Z`} fill={item.color} fillOpacity={theme === "light" ? 0.12 : 0.14} />
            )}
            <path d={points.map(([x, py], index) => `${index ? "L" : "M"}${x},${py}`).join(" ")} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map(([x, py], index) => (
              <circle key={index} cx={x} cy={py} r="3.5" fill={item.color} stroke={t.gap} strokeWidth="1.5">
                <title>{`${labels[index]} – ${item.name}: ${formatValue(item.values[index])}`}</title>
              </circle>
            ))}
            {points.length <= 14 &&
              points.map(([x, py], index) => (
                <text key={`v${index}`} x={x} y={py - 8} textAnchor="middle" fontSize="9.5" fill={t.muted}>
                  {colored.length === 1 ? formatValue(item.values[index]) : ""}
                </text>
              ))}
          </g>
        );
      })}
    </Frame>
  );
}

/** Oszlopdiagram: csoportosított vagy halmozott sorozatokkal (pl. belépők/kilépők, távollét típusonként). */
export function BarChart({ label, labels, series, stacked = false, theme = "dark", height = 220 }: { label: string; labels: string[]; series: Series[]; stacked?: boolean; theme?: ChartTheme; height?: number }) {
  const ml = 38;
  const mr = 12;
  const mt = 14;
  const mb = 26;
  const ph = height - mt - mb;
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
  const max = stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((item) => item.values));
  const ticks = niceTicks(max);
  const hi = ticks[ticks.length - 1] || 1;
  const y = (value: number) => mt + ph - (value / hi) * ph;
  const band = (W - ml - mr) / Math.max(1, labels.length);
  const colored = series.map((item, index) => ({ ...item, color: item.color ?? chartColor(index, theme) }));
  const group = Math.min(band * 0.72, stacked ? 34 : 18 * colored.length);
  const bw = stacked ? group : group / Math.max(1, colored.length);
  return (
    <Frame label={label} summary={describeSeries(labels, series)} height={height} empty={!labels.length || max === 0} legend={<Legend items={colored} theme={theme} />}>
      <Axes labels={labels} ticks={ticks} y={y} ml={ml} mr={mr} mt={mt} ph={ph} band={band} theme={theme} />
      {labels.map((name, index) => {
        const x0 = ml + band * index + (band - group) / 2;
        let base = 0;
        return (
          <g key={index}>
            {colored.map((item, s) => {
              const value = item.values[index] ?? 0;
              if (!value) return null;
              const top = stacked ? y(base + value) : y(value);
              const bottom = stacked ? y(base) : y(0);
              const x = stacked ? x0 : x0 + bw * s;
              base += stacked ? value : 0;
              return (
                <rect key={item.name} x={x + 0.5} y={top} width={Math.max(1, bw - 1)} height={Math.max(1, bottom - top)} rx={stacked ? 2 : 3} fill={item.color} className="pg-bar" style={{ transformBox: "fill-box" }}>
                  <title>{`${name} – ${item.name}: ${formatValue(value)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </Frame>
  );
}

/** Vízszintes sávdiagram kategóriákhoz (pl. munkakör, kilépési ok). */
export function HBarChart({ label, items, theme = "dark", color, max: limit = 12, unit = "" }: { label: string; items: Slice[]; theme?: ChartTheme; color?: string; max?: number; unit?: string }) {
  const t = THEMES[theme];
  const shown = items.slice(0, limit);
  const rest = items.slice(limit).reduce((sum, item) => sum + item.value, 0);
  const rows = rest ? [...shown, { label: `Egyéb (${items.length - limit})`, value: rest }] : shown;
  const ml = 170;
  const mr = 48;
  const row = 26;
  const height = rows.length * row + 8;
  const top = Math.max(1, ...rows.map((item) => item.value));
  const pw = W - ml - mr;
  return (
    <Frame label={label} summary={rows.map((item) => `${item.label}: ${formatValue(item.value)}${unit}`).join(", ")} height={height} empty={!rows.length || rows.every((item) => !item.value)}>
      {rows.map((item, index) => {
        const yy = 4 + index * row;
        const width = Math.max(2, (item.value / top) * pw);
        const fill = item.color ?? color ?? chartColor(index, theme);
        return (
          <g key={item.label}>
            <text x={ml - 8} y={yy + row / 2 + 3.5} textAnchor="end" fontSize="11" fill={t.text}>
              {clip(item.label, 26)}
            </text>
            <rect x={ml} y={yy + 5} width={pw} height={row - 10} rx="4" fill={t.grid} />
            <rect x={ml} y={yy + 5} width={width} height={row - 10} rx="4" fill={fill}>
              <title>{`${item.label}: ${formatValue(item.value)}${unit}`}</title>
            </rect>
            <text x={ml + width + 6} y={yy + row / 2 + 3.5} fontSize="10.5" fill={t.muted}>
              {formatValue(item.value)}
              {unit}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/** Fánkdiagram a részarányokhoz, középen az összeggel; a jelmagyarázat HTML-lista százalékokkal. */
export function DonutChart({ label, items, theme = "dark", centerLabel = "összesen", unit = "" }: { label: string; items: Slice[]; theme?: ChartTheme; centerLabel?: string; unit?: string }) {
  const t = THEMES[theme];
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  const colored = items.map((item, index) => ({ ...item, color: item.color ?? chartColor(index, theme) }));
  const lengths = colored.map((item) => (total ? (Math.max(0, item.value) / total) * c : 0));
  const offsets = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, value) => sum + value, 0));
  const pct = (value: number) => (total ? `${formatValue((value / total) * 100)}%` : "0%");
  const summary = `Összesen ${formatValue(total)}${unit}. ${colored.map((item) => `${item.label}: ${formatValue(item.value)}${unit} (${pct(item.value)})`).join(", ")}`;
  if (!total)
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-current/15 py-10 text-sm opacity-60" role="img" aria-label={`${label}: nincs adat az időszakban.`}>
        Nincs adat az időszakban.
      </div>
    );
  return (
    <figure className="m-0 flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 180 180" role="img" aria-label={`${label}. ${summary}`} className="size-40 shrink-0">
        <title>{label}</title>
        <g transform="rotate(-90 90 90)">
          <circle cx="90" cy="90" r={r} fill="none" stroke={t.grid} strokeWidth="22" />
          {colored.map((item, index) => (
            <circle key={item.label} cx="90" cy="90" r={r} fill="none" stroke={item.color} strokeWidth="22" strokeDasharray={`${Math.max(0, lengths[index] - 1.5)} ${c}`} strokeDashoffset={-offsets[index]}>
              <title>{`${item.label}: ${formatValue(item.value)}${unit} (${pct(item.value)})`}</title>
            </circle>
          ))}
        </g>
        <text x="90" y="88" textAnchor="middle" fontSize="24" fontWeight="600" fill={t.text}>
          {formatValue(total)}
        </text>
        <text x="90" y="106" textAnchor="middle" fontSize="10.5" fill={t.muted}>
          {centerLabel}
        </text>
      </svg>
      <ul className={`min-w-0 flex-1 space-y-1.5 text-sm ${theme === "light" ? "text-[#1f2937]" : "text-white/75"}`}>
        {colored.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: item.color }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="tabular-nums">{formatValue(item.value)}{unit}</span>
            <span className={`w-12 text-right text-xs tabular-nums ${theme === "light" ? "text-[#6b7280]" : "text-white/45"}`}>{pct(item.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

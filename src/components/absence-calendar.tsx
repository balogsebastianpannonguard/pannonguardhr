import Link from "next/link";
import { ABSENCE_COLORS, ABSENCE_TYPES, eachDay, holidayName, isWorkday, weekday, type AbsenceRow } from "@/lib/absences-meta";
import { formatDay } from "@/lib/dates";

const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const MAX_CHIPS = 4;

const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.slice(1).map((part) => `${part[0]}.`).join(" ")}` : name;
};

function Chip({ row }: { row: AbsenceRow }) {
  return (
    <Link
      href={`/tavollet/${row.id}`}
      title={`${row.employeeName} – ${ABSENCE_TYPES[row.type]}${row.halfDay ? " (fél nap)" : ""}`}
      className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-white/85 hover:bg-white/10"
      style={{ background: `${ABSENCE_COLORS[row.type]}26`, boxShadow: `inset 2px 0 0 ${ABSENCE_COLORS[row.type]}` }}
    >
      <span className="truncate">{shortName(row.employeeName)}</span>
      {row.halfDay && <span className="shrink-0 text-white/50">½</span>}
    </Link>
  );
}

/** Havi naptár: asztali nézetben hetes rács, mobilon napokra bontott lista (csak a távolléttel érintett napok). */
export function AbsenceCalendar({ month, rows, today }: { month: string; rows: AbsenceRow[]; today: string }) {
  const first = `${month}-01`;
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const days = eachDay(first, last);
  const lead = weekday(first) - 1;
  const onDay = (day: string) => rows.filter((row) => row.from <= day && row.to >= day);
  const busy = days.map((day) => ({ day, list: onDay(day), holiday: holidayName(day) })).filter((item) => item.list.length || item.holiday);

  return (
    <div>
      <div className="hidden md:block">
        <div aria-hidden className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-white/45">
          {WEEKDAYS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1.5" aria-label="Havi távollét-naptár">
          {Array.from({ length: lead }, (_, index) => (
            <li key={`lead-${index}`} aria-hidden />
          ))}
          {days.map((day) => {
            const list = onDay(day);
            const holiday = holidayName(day);
            const work = isWorkday(day);
            return (
              <li
                key={day}
                aria-label={`${formatDay(day)}: ${list.length ? `${list.length} fő távol` : "nincs távollét"}${holiday ? `, ${holiday}` : ""}`}
                className={`flex min-h-28 flex-col gap-1 rounded-xl border p-1.5 ${
                  day === today ? "border-rose/60 bg-rose/8" : work ? "border-white/8 bg-white/3" : "border-white/5 bg-white/[0.015]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-1 px-0.5">
                  <span className={`text-xs font-semibold tabular-nums ${work ? "text-white/80" : "text-white/35"}`}>{Number(day.slice(8))}</span>
                  {holiday && <span className="truncate text-[10px] text-pink-bright/80" title={holiday}>{holiday}</span>}
                </div>
                {list.slice(0, MAX_CHIPS).map((row) => (
                  <Chip key={row.id} row={row} />
                ))}
                {list.length > MAX_CHIPS && (
                  <span className="px-1 text-[11px] text-white/50" title={list.slice(MAX_CHIPS).map((row) => row.employeeName).join(", ")}>
                    +{list.length - MAX_CHIPS} fő
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="md:hidden">
        {busy.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">Ebben a hónapban nincs rögzített távollét.</p>
        ) : (
          <ol className="space-y-2">
            {busy.map(({ day, list, holiday }) => (
              <li key={day} className={`rounded-xl border p-3 ${day === today ? "border-rose/50" : "border-white/8"}`}>
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold">
                  <span className="capitalize">{formatDay(day)}</span>
                  {holiday && <span className="text-xs font-normal text-pink-bright/80">{holiday}</span>}
                </p>
                {list.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {list.map((row) => (
                      <li key={row.id}>
                        <Link href={`/tavollet/${row.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-white/5">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: ABSENCE_COLORS[row.type] }} />
                          <span className="min-w-0 flex-1 truncate">{row.employeeName}</span>
                          <span className="shrink-0 text-xs text-white/50">
                            {ABSENCE_TYPES[row.type]}
                            {row.halfDay && " · fél nap"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/55" aria-label="Jelmagyarázat">
        {Object.entries(ABSENCE_TYPES).map(([key, label]) => (
          <li key={key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: ABSENCE_COLORS[key as keyof typeof ABSENCE_TYPES] }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

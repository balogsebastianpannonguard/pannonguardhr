"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, LoaderCircle, Plus, Save, TriangleAlert } from "lucide-react";
import type { EmployeeOption } from "@/components/training-participant-picker";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { ABSENCE_TYPES, formatDays, workingDays, type AbsenceRow } from "@/lib/absences-meta";
import { checkAbsenceOverlap, createAbsence, updateAbsence, type AbsenceState } from "@/lib/actions/absences";

/** Távollét rögzítése vagy módosítása: élő munkanap-számítással és átfedés-figyelmeztetéssel. */
export function AbsenceForm({ absence, options, defaultDay }: { absence?: AbsenceRow; options: EmployeeOption[]; defaultDay?: string }) {
  const edit = Boolean(absence);
  const [state, action, pending] = useActionState<AbsenceState, FormData>(edit ? updateAbsence : createAbsence, {});
  const [employeeId, setEmployeeId] = useState(absence?.employeeId ?? "");
  const [from, setFrom] = useState(absence?.from ?? defaultDay ?? "");
  const [to, setTo] = useState(absence?.to ?? defaultDay ?? "");
  const [halfDay, setHalfDay] = useState(absence?.halfDay ?? false);
  const [query, setQuery] = useState("");
  const [overlap, setOverlap] = useState<string[]>([]);
  const [checking, startCheck] = useTransition();
  const request = useRef(0);

  const { ref, onSubmit } = useKeepForm(action, state, {
    resetOnOk: !edit,
    onReset: () => {
      setEmployeeId("");
      setFrom(defaultDay ?? "");
      setTo(defaultDay ?? "");
      setHalfDay(false);
      setOverlap([]);
      setQuery("");
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("hu");
    return options.filter(
      (option) => option.id === employeeId || ((option.status !== "kilepett" || option.id === absence?.employeeId) && (!q || `${option.name} ${option.position}`.toLocaleLowerCase("hu").includes(q))),
    );
  }, [options, query, employeeId, absence?.employeeId]);

  const end = to && to >= from ? to : from;
  const single = Boolean(from) && end === from;
  const days = from ? workingDays(from, end, halfDay && single) : 0;

  function check(next: { employeeId?: string; from?: string; to?: string }) {
    const e = next.employeeId ?? employeeId;
    const f = next.from ?? from;
    const t = next.to ?? to;
    const id = ++request.current;
    if (!e || !f) {
      setOverlap([]);
      return;
    }
    startCheck(async () => {
      const result = await checkAbsenceOverlap(e, f, t && t >= f ? t : f, absence?.id);
      if (id === request.current) setOverlap(result);
    });
  }

  const shownOverlap = state.overlap?.length && !overlap.length ? state.overlap : overlap;

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      {absence && <input type="hidden" name="id" value={absence.id} />}
      <div className="space-y-2">
        <Label label="Dolgozó">
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szűrés név vagy munkakör szerint" aria-label="Dolgozó keresése" />
        </Label>
        <Select
          name="employeeId"
          required
          value={employeeId}
          aria-label="Dolgozó"
          onChange={(event) => {
            setEmployeeId(event.target.value);
            check({ employeeId: event.target.value });
          }}
        >
          <option value="">– válassz ({visible.length}) –</option>
          {visible.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.position}
            </option>
          ))}
        </Select>
      </div>
      <Label label="Típus">
        <Select name="type" defaultValue={absence?.type ?? "szabadsag"}>
          {Object.entries(ABSENCE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Első nap">
          <Input
            name="from"
            type="date"
            required
            value={from}
            onChange={(event) => {
              const value = event.target.value;
              setFrom(value);
              const nextTo = !to || to < value ? value : to;
              setTo(nextTo);
              check({ from: value, to: nextTo });
            }}
          />
        </Label>
        <Label label="Utolsó nap">
          <Input
            name="to"
            type="date"
            required
            min={from || undefined}
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              check({ to: event.target.value });
            }}
          />
        </Label>
      </div>
      <label className={`flex items-center gap-2 text-sm ${single ? "text-white/70" : "text-white/35"}`}>
        <input type="checkbox" name="halfDay" checked={halfDay && single} disabled={!single} onChange={(event) => setHalfDay(event.target.checked)} className="size-4 accent-rose" />
        Fél nap (csak egynapos távollétnél)
      </label>
      <p className="flex items-center gap-2 rounded-xl bg-white/4 px-3 py-2 text-sm text-white/70">
        <CalendarDays size={15} aria-hidden className="text-rose" />
        {from ? (
          <>
            <strong className="tabular-nums">{formatDays(days)}</strong> munkanap
            <span className="text-xs text-white/40">(H–P, ünnepnapok nélkül)</span>
          </>
        ) : (
          "Add meg a napokat, és kiszámolom a munkanapokat."
        )}
        {checking && <LoaderCircle size={14} aria-hidden className="ml-auto animate-spin text-white/40" />}
      </p>
      {shownOverlap && shownOverlap.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={15} aria-hidden /> Átfedés egy meglévő távolléttel
          </p>
          <ul className="mt-1 list-disc pl-5 text-amber-100/80">
            {shownOverlap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="force" className="size-4 accent-rose" /> Mégis rögzítem
          </label>
        </div>
      )}
      <Label label="Megjegyzés">
        <Textarea name="note" rows={2} maxLength={500} defaultValue={absence?.note} className="min-h-16" placeholder="Nem kötelező. Egészségügyi adatot (diagnózist) ne írj ide." />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : edit ? <Save size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
          {edit ? "Mentés" : "Távollét rögzítése"}
        </button>
      </div>
    </form>
  );
}

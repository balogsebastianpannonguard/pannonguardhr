"use client";

import { useActionState, type ReactNode } from "react";
import { BriefcaseBusiness, HeartPulse, LoaderCircle, LockKeyhole, Save, UserRound, UserRoundPlus, type LucideIcon } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { createEmployee, updateEmployee } from "@/lib/actions/employees";
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, POSITION_SUGGESTIONS } from "@/lib/employee-meta";
import type { Employee } from "@/lib/employees";
import type { FormState } from "@/lib/form";
import { EmployeeSecretFields } from "@/components/employee-secret-fields";

export function FormSection({ title, icon: Icon, hint, children }: { title: string; icon: LucideIcon; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="pg-panel rounded-3xl p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-rose/15 text-rose">
            <Icon size={16} aria-hidden />
          </span>
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-white/50">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function EmployeeForm({
  employee,
  positions,
  departments,
}: {
  employee?: Employee;
  positions: string[];
  departments: string[];
}) {
  const edit = Boolean(employee);
  const [state, action, pending] = useActionState<FormState, FormData>(edit ? updateEmployee : createEmployee, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const positionList = [...new Set([...positions, ...POSITION_SUGGESTIONS])].sort((a, b) => a.localeCompare(b, "hu"));

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-6">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <datalist id="employee-positions">
        {positionList.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="employee-departments">
        {departments.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      <FormSection title="Alapadatok" icon={UserRound}>
        <Label label="Név" className="sm:col-span-2">
          <Input name="name" required minLength={2} maxLength={120} defaultValue={employee?.name} placeholder="Pl. Kovács Anna" autoComplete="off" />
        </Label>
        <Label label="E-mail">
          <Input name="email" type="email" maxLength={160} defaultValue={employee?.email} placeholder="Nem kötelező" autoComplete="off" />
        </Label>
        <Label label="Telefon">
          <Input name="phone" type="tel" maxLength={40} defaultValue={employee?.phone} placeholder="+36 30 123 4567" autoComplete="off" />
        </Label>
        <Label label="Munkakör">
          <Input name="position" list="employee-positions" required minLength={2} maxLength={80} defaultValue={employee?.position} placeholder="Pl. Vagyonőr" />
        </Label>
        <Label label="Egység / objektum">
          <Input name="department" list="employee-departments" maxLength={120} defaultValue={employee?.department} placeholder="Pl. Központi iroda" />
        </Label>
        <Label label="Közvetlen vezető" className="sm:col-span-2">
          <Input name="manager" maxLength={120} defaultValue={employee?.manager} placeholder="Nem kötelező" />
        </Label>
      </FormSection>

      <FormSection title="Munkaviszony" icon={BriefcaseBusiness}>
        <Label label="Állapot" hint={edit && employee?.status !== "kilepett" ? "A kilépést inkább a „Kilépés rögzítése” résznél vidd fel, ott a napja és oka is mentődik." : undefined}>
          <Select name="status" defaultValue={employee?.status ?? "belepes"}>
            {Object.entries(EMPLOYEE_STATUS)
              .filter(([value]) => edit || value !== "kilepett")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
        </Label>
        <Label label="Jogviszony">
          <Select name="employmentType" defaultValue={employee?.employmentType ?? "hatarozatlan"}>
            {Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Label>
        <Label label="Belépés napja">
          <Input name="startDate" type="date" defaultValue={employee?.startDate} />
        </Label>
        <Label label="Próbaidő vége">
          <Input name="probationEnd" type="date" defaultValue={employee?.probationEnd} />
        </Label>
        <Label label="Határozott idő vége" hint="Csak határozott idejű szerződésnél.">
          <Input name="contractEnd" type="date" defaultValue={employee?.contractEnd} />
        </Label>
        <Label label="Heti óraszám">
          <Input name="weeklyHours" inputMode="decimal" defaultValue={employee?.weeklyHours} placeholder="40" />
        </Label>
        <Label label="Legmagasabb iskolai végzettség" className="sm:col-span-2">
          <Input name="education" maxLength={160} defaultValue={employee?.education} placeholder="Pl. Érettségi, szakmunkás bizonyítvány" />
        </Label>
        <Label label="Megjegyzés" className="sm:col-span-2">
          <Textarea name="notes" rows={3} maxLength={4000} defaultValue={employee?.notes} className="min-h-20" placeholder="Belső megjegyzés, nem kötelező" />
        </Label>
      </FormSection>

      <FormSection title="Orvosi alkalmasság és vagyonőri igazolvány" icon={HeartPulse} hint="Ezekből a dátumokból figyeli a rendszer a lejáratokat.">
        <Label label="Foglalkozás-egészségügyi alkalmasság érvényes eddig" className="sm:col-span-2">
          <Input name="medicalExpiry" type="date" defaultValue={employee?.medicalExpiry} />
        </Label>
        <Label label="Vagyonőri igazolvány száma">
          <Input name="guardLicenseNumber" maxLength={40} defaultValue={employee?.guardLicenseNumber} placeholder="Nem kötelező" />
        </Label>
        <Label label="Vagyonőri igazolvány lejárata">
          <Input name="guardLicenseExpiry" type="date" defaultValue={employee?.guardLicenseExpiry} />
        </Label>
      </FormSection>

      {!edit && (
        <FormSection title="Bér és személyes adatok" icon={LockKeyhole} hint="Titkosítva tároljuk; később csak kifejezett kérésre, naplózva jelennek meg. Most ki is hagyhatod.">
          <EmployeeSecretFields />
        </FormSection>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : edit ? <Save size={17} aria-hidden /> : <UserRoundPlus size={17} aria-hidden />}
          {edit ? "Mentés" : "Munkavállaló felvétele"}
        </button>
      </div>
    </form>
  );
}

import { Input, Label, Select } from "@/components/ui";
import type { EmployeeSecret } from "@/lib/employee-meta";

/** A titkosított (EmployeeSecret) mezők űrlaprésze – a felvételi és a bizalmas-adat űrlap közösen használja. */
export function EmployeeSecretFields({ secret = {} }: { secret?: EmployeeSecret }) {
  return (
    <>
      <Label label="Bruttó alapbér (Ft)">
        <Input name="salary" inputMode="numeric" defaultValue={secret.salary} placeholder="Pl. 450000" autoComplete="off" />
      </Label>
      <Label label="Bérforma">
        <Select name="salaryType" defaultValue={secret.salaryType ?? "havi"}>
          <option value="havi">Havibér</option>
          <option value="oraber">Órabér</option>
        </Select>
      </Label>
      <Label label="Adóazonosító jel">
        <Input name="taxId" inputMode="numeric" maxLength={14} defaultValue={secret.taxId} placeholder="10 számjegy" autoComplete="off" />
      </Label>
      <Label label="TAJ-szám">
        <Input name="tajNumber" inputMode="numeric" maxLength={14} defaultValue={secret.tajNumber} placeholder="123 456 789" autoComplete="off" />
      </Label>
      <Label label="Bankszámlaszám" className="sm:col-span-2">
        <Input name="bankAccount" inputMode="numeric" maxLength={30} defaultValue={secret.bankAccount} placeholder="12345678-12345678-12345678" autoComplete="off" />
      </Label>
      <Label label="Lakcím" className="sm:col-span-2">
        <Input name="address" maxLength={240} defaultValue={secret.address} placeholder="Irányítószám, település, utca, házszám" autoComplete="off" />
      </Label>
      <Label label="Születési név">
        <Input name="birthName" maxLength={120} defaultValue={secret.birthName} autoComplete="off" />
      </Label>
      <Label label="Anyja neve">
        <Input name="motherName" maxLength={120} defaultValue={secret.motherName} autoComplete="off" />
      </Label>
      <Label label="Születési hely">
        <Input name="birthPlace" maxLength={80} defaultValue={secret.birthPlace} autoComplete="off" />
      </Label>
      <Label label="Születési idő">
        <Input name="birthDate" type="date" defaultValue={secret.birthDate} />
      </Label>
    </>
  );
}

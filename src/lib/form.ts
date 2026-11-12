/** Közös űrlap-segédek a szerverműveletekhez. */
export type FormState = { ok?: boolean; error?: string; message?: string; id?: string };

export const text = (formData: FormData, name: string, max = 200) =>
  String(formData.get(name) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);

export const longText = (formData: FormData, name: string, max = 20_000) =>
  String(formData.get(name) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

export const optional = (value: string) => value || undefined;

export function num(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").replace(/\s/g, "").replace(",", ".");
  if (raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH = /^\d{4}-\d{2}$/;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

export function emails(raw: string) {
  const list = raw.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  return { valid: [...new Set(list.filter((item) => EMAIL.test(item)))], invalid: list.filter((item) => !EMAIL.test(item)) };
}

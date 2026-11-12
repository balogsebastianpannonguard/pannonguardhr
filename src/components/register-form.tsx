"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { Field, inputClass } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { register, type RegisterState } from "@/lib/auth-actions";

const RULES = [
  { label: "Legalább 12 karakter", test: (value: string) => value.length >= 12 },
  { label: "Kis- és nagybetű", test: (value: string) => /[a-záéíóöőúüű]/.test(value) && /[A-ZÁÉÍÓÖŐÚÜŰ]/.test(value) },
  { label: "Szám vagy írásjel", test: (value: string) => /[\d\W_]/.test(value) },
];

export function RegisterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const score = RULES.filter(({ test }) => test(password)).length;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <Field label="Teljes név" icon={<UserRound size={18} aria-hidden />}>
        <input
          name="name"
          defaultValue={state.name}
          autoComplete="name"
          autoFocus
          required
          placeholder="Vezetéknév Keresztnév"
          className={inputClass}
        />
      </Field>

      <div>
        <Field label="Jelszó" icon={<Lock size={18} aria-hidden />}>
          <input
            name="password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
            className="rounded text-white/40 transition-colors hover:text-white"
          >
            {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </Field>
        <div aria-hidden className="mt-2.5 grid grid-cols-3 gap-1.5">
          {RULES.map((rule, index) => (
            <span
              key={rule.label}
              className={`h-1 rounded-full transition-colors ${
                index < score ? (score === 3 ? "bg-rose" : "bg-rose/55") : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {RULES.map(({ label, test }) => (
            <li
              key={label}
              className={`flex items-center gap-1 ${test(password) ? "text-rose-bright" : "text-white/40"}`}
            >
              <Check size={12} aria-hidden /> {label}
            </li>
          ))}
        </ul>
      </div>

      <Field label="Jelszó még egyszer" icon={<Lock size={18} aria-hidden />}>
        <input
          name="confirm"
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
        {confirm && (
          <Check
            size={18}
            aria-label={confirm === password ? "Egyezik" : undefined}
            className={confirm === password ? "text-rose" : "text-white/15"}
          />
        )}
      </Field>

      <p role="alert" className="min-h-5 text-sm font-medium text-red-300">
        {state.error}
      </p>
      <SubmitButton pending={pending}>
        Tovább a hitelesítőhöz
        <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
      </SubmitButton>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone } from "lucide-react";
import { CodeInput } from "@/components/code-input";
import { Field, inputClass } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { cancelLogin, login, type LoginState } from "@/lib/auth-actions";

const initialState: LoginState = { step: "password" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.step === "code") {
    return (
      <form action={action} className="pg-rise space-y-5">
        <input type="hidden" name="intent" value="code" />
        <div className="flex items-center gap-3 rounded-2xl border border-rose/25 bg-rose/8 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose/15 text-rose">
            <Smartphone size={19} aria-hidden />
          </span>
          <p className="text-sm text-white/75">
            Nyisd meg a hitelesítő alkalmazást, és írd be a <strong className="text-white">PannonGuard</strong>{" "}
            alatt látható hatjegyű kódot.
          </p>
        </div>
        <CodeInput disabled={pending} />
        <p role="alert" className="min-h-5 text-sm font-medium text-red-300">
          {state.error}
        </p>
        <SubmitButton pending={pending}>
          Belépés
          <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
        </SubmitButton>
        <button
          type="button"
          onClick={() => cancelLogin()}
          className="mx-auto flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
        >
          <ArrowLeft size={15} aria-hidden /> Másik fiók
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value="password" />
      {notice && !state.error && (
        <p className="rounded-xl border border-rose/20 bg-rose/8 px-4 py-3 text-sm text-rose-bright">
          {notice}
        </p>
      )}
      <Field label="E-mail-cím" icon={<Mail size={18} aria-hidden />}>
        <input
          name="email"
          type="email"
          defaultValue={state.email}
          autoComplete="username"
          autoFocus
          required
          className={inputClass}
        />
      </Field>
      <Field label="Jelszó" icon={<Lock size={18} aria-hidden />}>
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
          className="rounded text-white/40 transition-colors hover:text-white"
        >
          {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </Field>
      <p role="alert" className="min-h-5 text-sm font-medium text-red-300">
        {state.error}
      </p>
      <SubmitButton pending={pending}>
        Tovább
        <ArrowRight size={18} aria-hidden className="transition-transform group-hover:translate-x-1" />
      </SubmitButton>
      <p className="text-center text-xs text-white/40">
        Fiókot csak meghívóval lehet létrehozni.
      </p>
    </form>
  );
}

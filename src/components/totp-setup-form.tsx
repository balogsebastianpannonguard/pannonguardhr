"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { CodeInput } from "@/components/code-input";
import { SubmitButton } from "@/components/submit-button";
import { confirmTotpSetup, type CodeState } from "@/lib/auth-actions";

export function CopySecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(secret.replace(/\s/g, ""));
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-left transition hover:border-rose/40"
    >
      <code className="font-mono text-sm tracking-wider text-white/85 [word-spacing:0.15em]">{secret}</code>
      <span className="shrink-0 text-white/45 group-hover:text-rose">
        {copied ? <Check size={16} aria-label="Másolva" /> : <Copy size={16} aria-label="Kulcs másolása" />}
      </span>
    </button>
  );
}

export function TotpSetupForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(confirmTotpSetup, {});

  if (state.expired) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm font-medium text-red-300">
          {state.error}
        </p>
        <Link href="/login" className="text-sm text-rose underline underline-offset-4">
          Tovább a belépéshez
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <CodeInput disabled={pending} />
      <p role="alert" className="min-h-5 text-sm font-medium text-red-300">
        {state.error}
      </p>
      <SubmitButton pending={pending}>
        <ShieldCheck size={18} aria-hidden />
        Hitelesítő aktiválása
      </SubmitButton>
    </form>
  );
}

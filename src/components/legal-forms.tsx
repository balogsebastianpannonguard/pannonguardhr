"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, GitCompareArrows, LoaderCircle, MessageCircleQuestionMark, Sparkles } from "lucide-react";
import { LegalSourceField } from "@/components/legal-source-field";
import { Feedback, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { askLegalQuestion, compareLegalDocuments, reviewLegalDocument } from "@/lib/actions/legal-hr";
import type { FormState } from "@/lib/form";

/** Sikeres mentés után az elmentett tétel oldalára lép. */
function useOpenOnSuccess(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.id) router.push(`/jog/${state.id}`);
  }, [state, router]);
}

function Submit({ pending, aiOn, idle, busy, icon: Icon }: { pending: boolean; aiOn: boolean; idle: string; busy: string; icon: typeof Sparkles }) {
  return (
    <button type="submit" disabled={pending || !aiOn} className={buttonClass("primary")}>
      {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Icon size={17} aria-hidden />}
      {pending ? busy : idle}
    </button>
  );
}

export function LegalQuestionForm({ aiOn, examples }: { aiOn: boolean; examples: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(askLegalQuestion, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [question, setQuestion] = useState("");
  useOpenOnSuccess(state);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <Label label="Mit szeretnél tudni?" hint="Írd le a helyzetet is (pl. munkaidő-beosztás, munkaviszony hossza), mert sokszor ezen múlik a válasz.">
        <Textarea
          name="question"
          rows={5}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Pl. Hány nap szabadság jár egy 34 éves, egy gyermeket nevelő vagyonőrnek, aki 12 órás műszakokban dolgozik?"
          maxLength={4000}
        />
      </Label>
      <div>
        <p className="mb-2 text-xs font-medium text-white/50">Gyors indítás</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              className="max-w-full rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-left text-xs text-white/70 transition hover:border-rose/40 hover:text-white"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <Submit pending={pending} aiOn={aiOn} idle="Kérdés elküldése" busy="Válasz készül…" icon={MessageCircleQuestionMark} />
      </div>
    </form>
  );
}

export function LegalReviewForm({ aiOn }: { aiOn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewLegalDocument, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [title, setTitle] = useState("");
  useOpenOnSuccess(state);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <Label label="Az irat megnevezése" hint="Pl. Munkaidő-szabályzat 2026, vagyonőri munkaszerződés-minta.">
        <Input name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Az irat címe" />
      </Label>
      <LegalSourceField
        name="source"
        label="Az irat szövege"
        hint="Másold be a szöveget, vagy tölts fel PDF-et / fényképet. Legfeljebb 60 000 karakter."
        rows={12}
        placeholder="Ide illeszd be a szabályzat, szerződés vagy tájékoztató szövegét…"
        onFileName={(name) => setTitle((current) => current || name)}
      />
      <Label label="Mire figyeljen külön? (nem kötelező)">
        <Input name="focus" maxLength={800} placeholder="Pl. munkaidőkeret, adatkezelés, kamerás megfigyelés" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <Submit pending={pending} aiOn={aiOn} idle="Ellenőrzés" busy="Ellenőrzés folyamatban…" icon={FileSearch} />
      </div>
    </form>
  );
}

export function LegalCompareForm({ aiOn }: { aiOn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(compareLegalDocuments, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [titleA, setTitleA] = useState("");
  const [titleB, setTitleB] = useState("");
  useOpenOnSuccess(state);

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3 rounded-2xl border border-white/8 bg-white/2 p-4">
          <Label label="Régi változat neve">
            <Input name="titleA" value={titleA} onChange={(event) => setTitleA(event.target.value)} maxLength={80} placeholder="Pl. Munkarend 2025" />
          </Label>
          <LegalSourceField name="before" label="Régi szöveg" rows={10} placeholder="A korábbi változat szövege…" onFileName={(name) => setTitleA((current) => current || name)} />
        </div>
        <div className="min-w-0 space-y-3 rounded-2xl border border-white/8 bg-white/2 p-4">
          <Label label="Új változat neve">
            <Input name="titleB" value={titleB} onChange={(event) => setTitleB(event.target.value)} maxLength={80} placeholder="Pl. Munkarend 2026 tervezet" />
          </Label>
          <LegalSourceField name="after" label="Új szöveg" rows={10} placeholder="Az új változat szövege…" onFileName={(name) => setTitleB((current) => current || name)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <Submit pending={pending} aiOn={aiOn} idle="Összehasonlítás" busy="Összevetés folyamatban…" icon={GitCompareArrows} />
      </div>
    </form>
  );
}

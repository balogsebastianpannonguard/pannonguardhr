"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, ClipboardPaste, KeyRound, Lock, LoaderCircle, Upload, UserPlus } from "lucide-react";
import { Feedback, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { uploadTooBig, useKeepForm } from "@/components/use-keep-form";
import { createCandidate, importCvFiles, importCvText, type CvResult } from "@/lib/actions/recruitment";
import type { FormState } from "@/lib/form";
import { CV_ACCEPT, MAX_CV_FILES } from "@/lib/recruitment-meta";

const TABS = [
  { key: "upload", label: "Önéletrajz feltöltése", icon: Upload },
  { key: "paste", label: "Szöveg beillesztése", icon: ClipboardPaste },
  { key: "manual", label: "Kézi felvétel", icon: UserPlus },
] as const;

export function AddCandidate({ positionId, aiOn }: { positionId: string; aiOn: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(aiOn ? "upload" : "manual");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Jelölt felvétele" className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm transition ${
              tab === key ? "bg-rose/15 font-semibold text-rose-bright ring-1 ring-rose/40" : "text-white/60 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab !== "manual" && !aiOn && (
        <p className="flex gap-1.5 text-xs text-amber-200/90">
          <KeyRound size={13} aria-hidden className="mt-0.5 shrink-0" /> Az önéletrajz-feldolgozáshoz GEMINI_API_KEY szükséges; addig a kézi felvételt használd.
        </p>
      )}
      {tab === "upload" && <UploadCvs positionId={positionId} aiOn={aiOn} />}
      {tab === "paste" && <PasteCv positionId={positionId} aiOn={aiOn} />}
      {tab === "manual" && <ManualCandidate positionId={positionId} />}
      <p className="flex gap-1.5 text-xs leading-relaxed text-white/45">
        <Lock size={13} aria-hidden className="mt-0.5 shrink-0 text-rose" />
        Az önéletrajz fájlját nem tároljuk: az AI kiolvassa belőle a profilt és a szöveget, csak ezek kerülnek mentésre. A kinyert adatokat
        mindig ellenőrizd a jelölt oldalán.
      </p>
    </div>
  );
}

function UploadCvs({ positionId, aiOn }: { positionId: string; aiOn: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [results, setResults] = useState<CvResult[]>([]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const files = form.querySelector<HTMLInputElement>('input[type="file"]')?.files;
        const problem = uploadTooBig(form) ?? (files && files.length > MAX_CV_FILES ? `Egyszerre legfeljebb ${MAX_CV_FILES} fájlt válassz.` : undefined);
        setError(problem);
        if (problem) return;
        const formData = new FormData(form);
        start(async () => {
          const response = await importCvFiles(formData);
          setError(response.error);
          if (response.results) {
            setResults(response.results);
            form.reset();
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="positionId" value={positionId} />
      <label className="block rounded-2xl border border-dashed border-white/15 bg-white/3 p-5 text-center transition hover:border-rose/40">
        <Upload size={22} aria-hidden className="mx-auto text-rose" />
        <span className="mt-2 block text-sm font-medium">Válassz ki egy vagy több önéletrajzot</span>
        <span className="mt-1 block text-xs text-white/45">PDF, JPG vagy PNG · legfeljebb {MAX_CV_FILES} fájl, együtt 4 MB</span>
        <input name="files" type="file" multiple accept={CV_ACCEPT} required disabled={!aiOn} className="mt-3 w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-rose/15 file:px-3 file:py-1.5 file:text-rose-bright" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={error} />
        <button type="submit" disabled={pending || !aiOn} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Upload size={17} aria-hidden />}
          {pending ? "Feldolgozás…" : "Feldolgozás"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((result, index) => (
            <li key={`${result.fileName}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-white/60">{result.fileName}</span>
              {result.ok && result.id ? (
                <Link href={`/toborzas/${positionId}/jelolt/${result.id}`} className="font-semibold text-rose-bright hover:underline">
                  {result.name} →
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-red-300">
                  <CircleAlert size={14} aria-hidden /> {result.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function PasteCv({ positionId, aiOn }: { positionId: string; aiOn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(importCvText, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="positionId" value={positionId} />
      <Label label="Önéletrajz szövege" hint="Pl. e-mailből vagy állásportálról kimásolva.">
        <Textarea name="cv" required rows={8} maxLength={30_000} disabled={!aiOn} className="text-sm" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <button type="submit" disabled={pending || !aiOn} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <ClipboardPaste size={17} aria-hidden />}
          {pending ? "Feldolgozás…" : "Profil készítése"}
        </button>
      </div>
    </form>
  );
}

function ManualCandidate({ positionId }: { positionId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCandidate, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="positionId" value={positionId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Név">
          <Input name="name" required maxLength={120} autoComplete="off" />
        </Label>
        <Label label="E-mail">
          <Input name="email" type="email" maxLength={160} autoComplete="off" />
        </Label>
        <Label label="Telefon">
          <Input name="phone" type="tel" maxLength={40} autoComplete="off" />
        </Label>
        <Label label="Település">
          <Input name="location" maxLength={120} autoComplete="off" />
        </Label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <UserPlus size={17} aria-hidden />} Jelölt felvétele
        </button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, KeyRound, LoaderCircle, Mail, Plus, Save, Sparkles, Star, Trash2, UserCheck, X } from "lucide-react";
import { CopyButton } from "@/components/recruitment-tools";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import {
  addInterview,
  analyzeFit,
  deleteCandidate,
  deleteInterview,
  draftRejection,
  generateQuestions,
  hireCandidate,
  saveCandidateNotes,
  saveScorecard,
  setCandidateRating,
  setCandidateStage,
  updateCandidate,
} from "@/lib/actions/recruitment";
import type { FormState } from "@/lib/form";
import type { Candidate } from "@/lib/recruitment";
import { DEFAULT_CRITERIA, STAGES, STAGE_ORDER, type Stage } from "@/lib/recruitment-meta";

/* ---------- Szakasz és értékelés ---------- */

export function StageControl({ id, stage }: { id: string; stage: Stage }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Szakasz">
        {STAGE_ORDER.map((item) => (
          <button
            key={item}
            type="button"
            disabled={pending}
            aria-pressed={item === stage}
            onClick={() =>
              start(async () => {
                const result = await setCandidateStage(id, item);
                setError(result.error);
              })
            }
            className={`h-9 rounded-xl px-3 text-sm transition disabled:opacity-60 ${
              item === stage
                ? item === "elutasitva"
                  ? "bg-red-500/15 font-semibold text-red-200 ring-1 ring-red-400/40"
                  : item === "felveve"
                    ? "bg-emerald-400/15 font-semibold text-emerald-200 ring-1 ring-emerald-300/40"
                    : "bg-rose/20 font-semibold text-rose-bright ring-1 ring-rose/50"
                : "border border-white/10 text-white/60 hover:bg-white/6 hover:text-white"
            }`}
          >
            {STAGES[item]}
          </button>
        ))}
        {pending && <LoaderCircle size={16} aria-hidden className="m-2 animate-spin text-rose" />}
      </div>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function RatingControl({ id, rating }: { id: string; rating?: number }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(rating ?? 0);
  const set = (next: number) => {
    setValue(next);
    start(async () => void (await setCandidateRating(id, next)));
  };
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Értékelés 1–5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={pending}
          onClick={() => set(star === value ? 0 : star)}
          aria-label={`${star} csillag`}
          aria-pressed={star <= value}
          className="grid size-9 place-items-center rounded-lg transition hover:bg-white/6"
        >
          <Star size={20} aria-hidden className={star <= value ? "fill-amber-300 text-amber-300" : "text-white/25"} />
        </button>
      ))}
      <span className="ml-1 text-sm text-white/50">{value ? `${value}/5` : "Nincs értékelve"}</span>
    </div>
  );
}

/* ---------- Profil ---------- */

export function ProfileForm({ candidate }: { candidate: Candidate }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCandidate, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={candidate.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Név">
          <Input name="name" required maxLength={120} defaultValue={candidate.name} />
        </Label>
        <Label label="E-mail">
          <Input name="email" type="email" maxLength={160} defaultValue={candidate.email} />
        </Label>
        <Label label="Telefon">
          <Input name="phone" type="tel" maxLength={40} defaultValue={candidate.phone} />
        </Label>
        <Label label="Település">
          <Input name="location" maxLength={120} defaultValue={candidate.location} />
        </Label>
        <Label label="Jogosítvány">
          <Input name="drivingLicence" maxLength={60} defaultValue={candidate.drivingLicence} placeholder="Pl. B" />
        </Label>
        <Label label="Mikortól, milyen műszakban">
          <Input name="availability" maxLength={200} defaultValue={candidate.availability} placeholder="Pl. azonnal, éjszakai műszak is" />
        </Label>
      </div>
      <Label label="Összefoglaló">
        <Textarea name="summary" rows={3} maxLength={1500} defaultValue={candidate.summary} className="min-h-20" />
      </Label>
      <Label label="Munkatapasztalat" hint="Soronként: időszak | munkakör | munkáltató | megjegyzés">
        <Textarea
          name="experience"
          rows={5}
          maxLength={8000}
          className="font-mono text-xs"
          defaultValue={candidate.experience.map((item) => [item.period, item.role, item.employer, item.description].join(" | ").replace(/( \| )+$/, "")).join("\n")}
        />
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Végzettség" hint="Soronként egy.">
          <Textarea name="education" rows={3} maxLength={2000} className="min-h-20 text-sm" defaultValue={candidate.education.join("\n")} />
        </Label>
        <Label label="Képesítések, igazolványok" hint="Soronként: megnevezés | szám | lejárat (ÉÉÉÉ-HH-NN)">
          <Textarea
            name="qualifications"
            rows={3}
            maxLength={4000}
            className="min-h-20 text-sm"
            defaultValue={candidate.qualifications.map((item) => [item.name, item.number ?? "", item.expiresAt ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n")}
          />
        </Label>
        <Label label="Nyelvek" hint="Vesszővel elválasztva.">
          <Input name="languages" maxLength={800} defaultValue={candidate.languages.join(", ")} />
        </Label>
        <Label label="Készségek" hint="Vesszővel elválasztva.">
          <Input name="skills" maxLength={2000} defaultValue={candidate.skills.join(", ")} />
        </Label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <Save size={17} aria-hidden />} Mentés
        </button>
      </div>
    </form>
  );
}

export function NotesForm({ id, notes }: { id: string; notes?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCandidateNotes, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Textarea name="notes" rows={4} maxLength={8000} defaultValue={notes} aria-label="Jegyzet" placeholder="Telefonos egyeztetés, benyomások, megbeszéltek…" className="text-sm" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />} Jegyzet mentése
        </button>
      </div>
    </form>
  );
}

/* ---------- Interjúk ---------- */

export function InterviewForm({ id, interviewer }: { id: string; interviewer: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addInterview, {});
  const { ref, onSubmit } = useKeepForm(action, state, { resetOnOk: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Label label="Nap">
          <Input name="date" type="date" required />
        </Label>
        <Label label="Időpont">
          <Input name="time" type="time" required />
        </Label>
        <Label label="Helyszín">
          <Input name="place" maxLength={160} placeholder="Pl. központi iroda / online" />
        </Label>
        <Label label="Interjúztató">
          <Input name="interviewer" maxLength={120} defaultValue={interviewer} />
        </Label>
      </div>
      <Label label="Megjegyzés">
        <Input name="note" maxLength={1000} placeholder="Nem kötelező" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Feedback error={state.error} message={state.ok ? state.message : undefined} />
        <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <CalendarClock size={15} aria-hidden />} Interjú rögzítése
        </button>
      </div>
    </form>
  );
}

export function DeleteInterviewButton({ candidateId, interviewId }: { candidateId: string; interviewId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await deleteInterview(candidateId, interviewId)))}
      aria-label="Interjú törlése"
      className="grid size-8 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-red-500/10 hover:text-red-200"
    >
      {pending ? <LoaderCircle size={14} aria-hidden className="animate-spin" /> : <X size={15} aria-hidden />}
    </button>
  );
}

export function ScorecardForm({ id, scorecard }: { id: string; scorecard?: Candidate["scorecard"] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScorecard, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [rows, setRows] = useState(() =>
    (scorecard?.criteria.length ? scorecard.criteria : DEFAULT_CRITERIA.map((name) => ({ name, score: undefined, note: undefined }))).map((item, index) => ({
      key: index,
      ...item,
    })),
  );
  const scored = rows.filter((row) => row.score);
  const average = scored.length ? scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length : 0;

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="criterion"
                defaultValue={row.name}
                maxLength={80}
                aria-label="Szempont"
                className="pg-field min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white"
              />
              <Select
                name="score"
                defaultValue={row.score ? String(row.score) : ""}
                onChange={(event) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, score: Number(event.target.value) || undefined } : item)))}
                aria-label={`${row.name} pontszám`}
                className="h-9 w-24 text-sm"
              >
                <option value="">–</option>
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score} / 5
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                aria-label="Szempont eltávolítása"
                className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-white/6 hover:text-white"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
            <input
              name="criterionNote"
              defaultValue={row.note}
              maxLength={500}
              placeholder="Megjegyzés (nem kötelező)"
              aria-label={`${row.name} megjegyzés`}
              className="pg-field mt-2 w-full rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={rows.length >= 12}
        onClick={() => setRows((current) => [...current, { key: Date.now(), name: "", score: undefined, note: undefined }])}
        className={buttonClass("ghost", "sm")}
      >
        <Plus size={15} aria-hidden /> Új szempont
      </button>
      <Label label="Összegzés">
        <Textarea name="scoreNotes" rows={3} maxLength={4000} defaultValue={scorecard?.notes} className="min-h-20 text-sm" />
      </Label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/55">
          Átlag: <strong className="text-white">{average ? average.toFixed(1).replace(".", ",") : "–"}</strong>
          {scored.length > 0 && ` (${scored.length} szempont)`}
        </p>
        <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />} Értékelőlap mentése
        </button>
      </div>
      <Feedback error={state.error} message={state.ok ? state.message : undefined} />
    </form>
  );
}

/* ---------- AI ---------- */

export function AiRunButton({ id, kind, aiOn, done }: { id: string; kind: "fit" | "questions"; aiOn: boolean; done: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const label = kind === "fit" ? (done ? "Újraelemzés" : "AI illeszkedés elemzése") : done ? "Új kérdések" : "Interjúkérdések generálása";
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || !aiOn}
        onClick={() =>
          start(async () => {
            const result = kind === "fit" ? await analyzeFit(id) : await generateQuestions(id);
            setError(result.error);
          })
        }
        className={buttonClass(done ? "secondary" : "primary", "sm")}
      >
        {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Sparkles size={15} aria-hidden />}
        {pending ? "Dolgozom…" : label}
      </button>
      {!aiOn && (
        <span className="flex gap-1 text-xs text-amber-200/90">
          <KeyRound size={12} aria-hidden className="mt-0.5" /> GEMINI_API_KEY szükséges
        </span>
      )}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function RejectionDraft({ id, initial }: { id: string; initial?: string }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState(initial ?? "");
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await draftRejection(id);
              setError(result.error);
              if (result.text) setText(result.text);
            })
          }
          className={buttonClass("secondary", "sm")}
        >
          {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Mail size={15} aria-hidden />}
          {text ? "Új vázlat" : "Elutasító levél vázlata"}
        </button>
        {text && <CopyButton text={text} />}
      </div>
      {text && <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} aria-label="Elutasító levél" className="text-sm" />}
      {text && <p className="text-xs text-white/40">Vázlat: a rendszer nem küldi el. Másold ki, és a saját leveleződből küldd el.</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

/* ---------- Felvétel és törlés ---------- */

export function HireForm({ id, employeeId, eligible }: { id: string; employeeId?: string; eligible: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(hireCandidate, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const linked = employeeId ?? (state.ok ? state.id : undefined);

  if (linked) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-emerald-200">A jelölt munkavállalóként szerepel a nyilvántartásban.</p>
        <Link href={`/munkavallalok/${linked}`} className={buttonClass("primary", "sm")}>
          <ExternalLink size={15} aria-hidden /> Munkavállaló adatlapja
        </Link>
      </div>
    );
  }
  if (!eligible) return <p className="text-sm text-white/50">A felvétel az Ajánlat vagy Felvéve szakaszban indítható.</p>;
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Label label="Tervezett kezdés" hint="Nem kötelező; később a munkavállaló adatlapján is megadhatod.">
        <Input name="startDate" type="date" />
      </Label>
      <button type="submit" disabled={pending} className={buttonClass("primary")}>
        {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <UserCheck size={17} aria-hidden />} Felvétel – munkavállaló létrehozása
      </button>
      <Feedback error={state.error} />
      {state.error && state.id && (
        <Link href={`/munkavallalok/${state.id}`} className="text-sm text-rose-bright hover:underline">
          Meglévő munkavállaló megnyitása →
        </Link>
      )}
    </form>
  );
}

export function DeleteCandidateButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClass("danger", "sm")}
        onClick={() => {
          if (!confirm("Biztosan véglegesen törlöd a jelölt összes adatát? Ez nem vonható vissza.")) return;
          start(async () => {
            const result = await deleteCandidate(id);
            setError(result?.error);
          });
        }}
      >
        {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Jelölt adatainak törlése
      </button>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, GitCompareArrows, LoaderCircle, MapPin, Star } from "lucide-react";
import { Pill, buttonClass } from "@/components/ui";
import { setCandidateStage } from "@/lib/actions/recruitment";
import { STAGES, STAGE_ORDER, STAGE_TONE, type Stage } from "@/lib/recruitment-meta";

export type PipelineCard = {
  id: string;
  name: string;
  stage: Stage;
  location?: string;
  rating?: number;
  fitScore?: number;
  guardLicence: boolean;
  nextInterview?: string;
  hired: boolean;
};

const STAGE_ACCENT: Record<Stage, string> = {
  beerkezett: "border-t-white/25",
  szures: "border-t-pink-bright/60",
  interju: "border-t-pink/70",
  ajanlat: "border-t-amber-300/70",
  felveve: "border-t-emerald-300/70",
  elutasitva: "border-t-red-400/60",
};

/** Kiválasztási folyamat szakaszonként; mobilon is gombbal/legördülővel mozgatható. */
export function Pipeline({ positionId, cards }: { positionId: string; cards: PipelineCard[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= 4 ? current : [...current, id]));
  const compareHref = `/toborzas/${positionId}/osszehasonlitas?${selected.map((id) => `c=${id}`).join("&")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
        <p className="text-sm text-white/60">
          <GitCompareArrows size={15} aria-hidden className="mr-1.5 inline text-rose" />
          {selected.length ? `${selected.length} jelölt kiválasztva (legfeljebb 4)` : "Jelölj ki 2–4 jelöltet az összehasonlításhoz."}
        </p>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])} className={buttonClass("ghost", "sm")}>
              Kijelölés törlése
            </button>
          )}
          {selected.length >= 2 ? (
            <Link href={compareHref} className={buttonClass("primary", "sm")}>
              Összehasonlítás
            </Link>
          ) : (
            <button type="button" disabled className={buttonClass("primary", "sm")}>
              Összehasonlítás
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STAGE_ORDER.map((stage) => {
          const items = cards.filter((card) => card.stage === stage);
          return (
            <section key={stage} className={`rounded-2xl border border-t-2 border-white/8 bg-white/2 p-3 ${STAGE_ACCENT[stage]}`} aria-label={STAGES[stage]}>
              <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                {STAGES[stage]}
                <Pill tone={items.length ? STAGE_TONE[stage] : "muted"}>{items.length}</Pill>
              </h3>
              {items.length === 0 ? (
                <p className="px-1 py-3 text-xs text-white/35">Nincs jelölt ebben a szakaszban.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((card) => (
                    <CandidateCard key={card.id} positionId={positionId} card={card} checked={selected.includes(card.id)} onToggle={() => toggle(card.id)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({ positionId, card, checked, onToggle }: { positionId: string; card: PipelineCard; checked: boolean; onToggle: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <li className={`pg-card rounded-xl p-3 ${checked ? "border-rose/50 bg-rose/5" : ""}`}>
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`${card.name} kijelölése összehasonlításhoz`}
          className="mt-1 size-4 shrink-0 accent-rose"
        />
        <div className="min-w-0 flex-1">
          <Link href={`/toborzas/${positionId}/jelolt/${card.id}`} className="block truncate font-semibold hover:text-rose-bright">
            {card.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            {card.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} aria-hidden /> {card.location}
              </span>
            )}
            {card.guardLicence && (
              <span className="flex items-center gap-1 text-rose-bright">
                <BadgeCheck size={12} aria-hidden /> Vagyonőri ig.
              </span>
            )}
            {card.rating ? (
              <span className="flex items-center gap-0.5 text-amber-200" aria-label={`Értékelés: ${card.rating}/5`}>
                <Star size={12} aria-hidden className="fill-current" /> {card.rating}/5
              </span>
            ) : null}
            {card.fitScore !== undefined && <span title="AI illeszkedés – csak támogatás">AI: {card.fitScore}%</span>}
            {card.nextInterview && (
              <span className="flex items-center gap-1">
                <CalendarClock size={12} aria-hidden /> {card.nextInterview}
              </span>
            )}
            {card.hired && <Pill tone="ok">Munkavállaló</Pill>}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={card.stage}
          disabled={pending}
          aria-label={`${card.name} szakasza`}
          onChange={(event) => {
            const stage = event.target.value;
            start(async () => {
              const result = await setCandidateStage(card.id, stage);
              setError(result.error);
            });
          }}
          className="pg-field h-8 min-w-0 flex-1 rounded-lg px-2 text-xs text-white [&>option]:bg-ink-900"
        >
          {STAGE_ORDER.map((stage) => (
            <option key={stage} value={stage}>
              {STAGES[stage]}
            </option>
          ))}
        </select>
        {pending && <LoaderCircle size={14} aria-hidden className="animate-spin text-rose" />}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
    </li>
  );
}

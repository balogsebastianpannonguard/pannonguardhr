/** Toborzás: a kliens- és szerveroldalon is használt szótárak (nincs bennük szerveres függőség). */
import type { Tone } from "@/components/ui";

export const POSITION_STATUS = {
  nyitott: "Nyitott",
  szunetel: "Szünetel",
  lezart: "Lezárt",
} as const;
export type PositionStatus = keyof typeof POSITION_STATUS;
export const POSITION_TONE: Record<PositionStatus, Tone> = { nyitott: "ok", szunetel: "warning", lezart: "muted" };

export const STAGES = {
  beerkezett: "Beérkezett",
  szures: "Szűrés",
  interju: "Interjú",
  ajanlat: "Ajánlat",
  felveve: "Felvéve",
  elutasitva: "Elutasítva",
} as const;
export type Stage = keyof typeof STAGES;
export const STAGE_ORDER = Object.keys(STAGES) as Stage[];
export const STAGE_TONE: Record<Stage, Tone> = {
  beerkezett: "muted",
  szures: "info",
  interju: "info",
  ajanlat: "warning",
  felveve: "ok",
  elutasitva: "error",
};

export const AD_TONES = { hivatalos: "Hivatalos", baratsagos: "Barátságos" } as const;
export type AdTone = keyof typeof AD_TONES;

export const CANDIDATE_SOURCES = { cv: "Feltöltött önéletrajz", szoveg: "Beillesztett szöveg", kezi: "Kézi felvétel" } as const;
export type CandidateSource = keyof typeof CANDIDATE_SOURCES;

/** Az interjú-értékelőlap alap szempontjai egy biztonsági szolgáltatónál. */
export const DEFAULT_CRITERIA = [
  "Szakmai tapasztalat",
  "Megbízhatóság, pontosság",
  "Kommunikáció, ügyfélkezelés",
  "Stressztűrés, konfliktuskezelés",
  "Műszakrend vállalása",
  "Képesítések, igazolványok",
];

export const isStage = (value: string): value is Stage => value in STAGES;
export const isPositionStatus = (value: string): value is PositionStatus => value in POSITION_STATUS;

/** Ennyi feltöltött önéletrajz dolgozható fel egyszerre. */
export const MAX_CV_FILES = 6;
export const CV_ACCEPT = ".pdf,.jpg,.jpeg,.png";

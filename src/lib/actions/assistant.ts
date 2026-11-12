"use server";

import type { BriefingItem } from "@/components/pajzsi/api";
import { AiError, aiAvailable, aiChat, type ChatTurn } from "@/lib/ai";
import { buildSystemPrompt, loadBriefing, takeQuota } from "@/lib/assistant";
import { countActiveSessions, requireUser } from "@/lib/session";

export type AssistantState = { reply?: string; error?: string };

const MAX_TURNS = 10;
const MAX_CHARS = 1500;

function cleanTurns(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];
  const turns = input
    .filter(
      (turn): turn is ChatTurn =>
        typeof turn === "object" &&
        turn !== null &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0,
    )
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);
  // A beszélgetésnek felhasználói üzenettel kell kezdődnie, és azzal is kell végződnie.
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return [];
  return turns;
}

async function briefingFor() {
  const user = await requireUser();
  const sessions = await countActiveSessions(user.session.userId);
  return { user, briefing: await loadBriefing(user, sessions) };
}

export async function assistantBriefing(): Promise<BriefingItem[]> {
  return (await briefingFor()).briefing;
}

export async function askAssistant(history: ChatTurn[]): Promise<AssistantState> {
  const { user, briefing } = await briefingFor();
  if (!aiAvailable()) return { error: "A csevegés még nincs bekapcsolva (hiányzik a GEMINI_API_KEY)." };

  const turns = cleanTurns(history);
  if (!turns.length) return { error: "Írj be egy kérdést." };
  if (!(await takeQuota(user.id, "chat", 40))) return { error: "Elfogyott az óránkénti keret (40 kérdés). Próbáld újra később." };

  try {
    const { reply } = await aiChat({ system: buildSystemPrompt(briefing, new Date(), user.firstName), turns });
    return { reply };
  } catch (error) {
    if (error instanceof AiError) return { error: error.message };
    console.error("Asszisztens hiba:", (error as Error).name);
    return { error: "Váratlan hiba történt, próbáld újra." };
  }
}

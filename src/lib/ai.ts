import "server-only";
import { GEMINI_FAST, GeminiError, geminiAvailable, geminiGenerate } from "@/lib/gemini";

export class AiError extends Error {}

const MISSING_KEY = "Az AI-funkciókhoz GEMINI_API_KEY szükséges.";

/** Az AI-funkciók akkor érhetők el, ha a szerveren van Gemini-kulcs. */
export function aiAvailable() {
  return geminiAvailable();
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Rövid, olcsó csevegés a lebegő asszisztenshez (gyors modell, kis válaszkorlát). */
export async function aiChat({ system, turns, maxTokens = 900 }: { system: string; turns: ChatTurn[]; maxTokens?: number }) {
  if (!aiAvailable()) throw new AiError(MISSING_KEY);
  try {
    const reply = await geminiGenerate({
      model: GEMINI_FAST,
      system,
      turns: turns.map(({ role, content }) => ({ role: role === "assistant" ? "model" : "user", parts: [{ text: content }] })),
      maxTokens,
      timeoutMs: 45_000,
    });
    return { reply };
  } catch (error) {
    if (error instanceof GeminiError) throw new AiError(error.message);
    if ((error as Error)?.name === "TimeoutError") throw new AiError("Az AI túl sokáig válaszolt.");
    throw new AiError("Az AI most nem érhető el.");
  }
}

/**
 * Google Gemini (REST) – olcsó, gyors szolgáltató a csevegéshez, a fordításhoz és a levélvázlatokhoz,
 * illetve tartalékként a jelentés- és ajánlatelemzéshez, ha nincs Claude API-kulcs.
 * Csak a szerverről hívható (a kulcs a GEMINI_API_KEY környezeti változóban van); a `lib/ai.ts` importálja.
 */

/** Olcsó, gyors modell: csevegés, fordítás, levélvázlat. */
export const GEMINI_FAST = "gemini-3.5-flash-lite";
/** Erősebb modell: jelentések és ajánlatok sémához kötött elemzése. */
export const GEMINI_SMART = "gemini-3.5-flash";

export class GeminiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiTurn = { role: "user" | "model"; parts: GeminiPart[] };

export function geminiAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

type Candidate = { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string };
type Response = {
  candidates?: Candidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function geminiGenerate({
  model,
  system,
  turns,
  maxTokens,
  jsonSchema,
  timeoutMs = 90_000,
}: {
  model: string;
  system?: string;
  turns: GeminiTurn[];
  maxTokens: number;
  /** Ha meg van adva, a válasz ennek a JSON-sémának megfelelő JSON-szöveg. */
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Az AI-funkciókhoz GEMINI_API_KEY szükséges.");

  const body = JSON.stringify({
    ...(system && { systemInstruction: { parts: [{ text: system }] } }),
    contents: turns,
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(jsonSchema && { responseMimeType: "application/json", responseJsonSchema: jsonSchema }),
    },
  });

  // A teljes időkeret az újrapróbálásokkal együtt érvényes, hogy a szerverfüggvény időkorlátja előtt barátságos hibát adjunk.
  const deadline = Date.now() + timeoutMs;
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) {
      if (deadline - Date.now() < 10_000) throw new GeminiError("Az AI túl sokáig válaszolt, próbáld újra rövidebb bemenettel.");
      await sleep(700 * attempt);
    }
    let response: Response & { _status?: number };
    try {
      const raw = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
        cache: "no-store",
      });
      lastStatus = raw.status;
      const textBody = await raw.text();
      response = textBody ? (JSON.parse(textBody) as Response) : {};
      response._status = raw.status;
    } catch (error) {
      if (attempt < 2) continue;
      throw new GeminiError((error as Error).name === "TimeoutError" ? "Az AI túl sokáig válaszolt." : "Nem érhető el a Gemini API.");
    }

    if (response._status === 429 || (response._status ?? 0) >= 500 || (!response.candidates && !response.error && !response.promptFeedback)) {
      if (attempt < 2) continue;
    }
    if (response.error) {
      const status = response.error.code ?? lastStatus;
      if (status === 401 || status === 403) throw new GeminiError("Érvénytelen vagy nem engedélyezett Gemini API-kulcs.", status);
      if (status === 429) throw new GeminiError("Az AI most túlterhelt, próbáld újra egy perc múlva.", status);
      if (status === 400) throw new GeminiError("Az AI nem tudta feldolgozni a kérést (túl nagy vagy hibás bemenet).", status);
      throw new GeminiError(`AI-hiba (${status ?? "ismeretlen"}).`, status);
    }
    if (response.promptFeedback?.blockReason) throw new GeminiError("Az AI ezt a kérést nem dolgozta fel.");

    const candidate = response.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (candidate?.finishReason === "MAX_TOKENS" && jsonSchema) throw new GeminiError("Az AI-válasz túl hosszú lett, próbáld rövidebb bemenettel.");
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") throw new GeminiError("Az AI ezt a kérést nem dolgozta fel.");
    if (!text) {
      if (attempt < 2) continue;
      throw new GeminiError("Az AI üres választ adott.");
    }
    return text;
  }
  throw new GeminiError("Az AI most nem válaszolt, próbáld újra.");
}

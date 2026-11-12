export type ChatMessage = { role: "user" | "assistant"; content: string };

export type BriefingItem = { tone: "ok" | "warn" | "bad" | "info"; text: string; href?: string };

export type TicketInput = { kind: string; priority: string; title: string; description: string; page: string; diagnostics?: string[] };
export type TicketResult = { ok?: boolean; number?: string; emailed?: boolean; error?: string };

/** A szerveroldali műveletek csomagja, amit a lebegő ablak használ. */
export type PajzsiApi = {
  ask: (history: ChatMessage[]) => Promise<{ reply?: string; error?: string }>;
  briefing: () => Promise<BriefingItem[]>;
  ticket: (input: TicketInput) => Promise<TicketResult>;
};

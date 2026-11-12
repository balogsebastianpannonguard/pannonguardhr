"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Bug, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { BriefingItem, PajzsiApi } from "@/components/pajzsi/api";
import { ChatTab, type TabKey, type Turn } from "@/components/pajzsi/chat";
import { Mascot, type Mood } from "@/components/pajzsi/mascot";
import { TicketForm } from "@/components/pajzsi/ticket";

const STORAGE_KEY = "pg-hr-pajzsi-v1";
const BUBBLE_KEY = "pg-hr-pajzsi-bubble";

/** Bármelyik oldal megnyithatja vele a bejelentést: `window.dispatchEvent(new CustomEvent(PAJZSI_TICKET_EVENT, { detail }))`. */
export const PAJZSI_TICKET_EVENT = "pajzsi:ticket";
export type PajzsiTicketDetail = { text?: string; diagnostics?: string[] };

const clock = () => new Date().toLocaleTimeString("hu-HU", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** E-mail-címek és hosszú tokenek kitakarása a technikai naplóból. */
const scrub = (value: string) =>
  value
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[azonosító]")
    .slice(0, 240);

const SUBTITLE: Record<Mood, string> = {
  idle: "A HR védőangyala",
  think: "Gondolkodom…",
  talk: "Válaszolok…",
  happy: "Örülök, hogy segíthettem! 💗",
};

export function Pajzsi({ api, aiOn, defaultOpen = false }: { api: PajzsiApi; aiOn: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<TabKey>("chat");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [briefing, setBriefing] = useState<BriefingItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<Mood | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ticketSeed, setTicketSeed] = useState("");
  const [ticketPage, setTicketPage] = useState("/");
  const [bubble, setBubble] = useState<string | null>(null);
  const [ticketDiagnostics, setTicketDiagnostics] = useState<string[]>([]);
  const clientIssues = useRef<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const typing = turns.some((turn) => turn.role === "assistant" && turn.typed === false && !turn.error);
  const mood: Mood = override ?? (pending ? "think" : typing ? "talk" : "idle");

  const celebrate = () => {
    setOverride("happy");
    setTimeout(() => setOverride(null), 2600);
  };

  // A böngészőben fellépő hibák rövid, kitakart naplója: a bejelentéshez automatikusan mellékeljük.
  useEffect(() => {
    const push = (line: string) => {
      clientIssues.current = [...clientIssues.current, `${clock()} ${window.location.pathname} · ${scrub(line)}`].slice(-8);
    };
    const onError = (event: ErrorEvent) => push(`Hiba: ${event.message || "ismeretlen"}`);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "ismeretlen");
      push(`Elutasított művelet: ${reason}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Köszöntő buborék: egyszer egy munkamenetben, pár másodperccel az oldal betöltése után.
  useEffect(() => {
    if (open) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(BUBBLE_KEY) === "1";
    } catch {}
    if (seen) return;
    const show = setTimeout(() => {
      setBubble("Szia! Pajzsi vagyok, segíthetek? 💗");
      try {
        sessionStorage.setItem(BUBBLE_KEY, "1");
      } catch {}
    }, 3200);
    const hide = setTimeout(() => setBubble(null), 11_000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [open]);

  function toggle() {
    if (!loaded) {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) setTurns((JSON.parse(saved) as Turn[]).map((turn) => ({ ...turn, typed: true })));
      } catch {}
      setLoaded(true);
    }
    setBubble(null);
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-20)));
    } catch {}
  }, [turns, loaded]);

  useEffect(() => {
    if (!open || briefing) return;
    api
      .briefing()
      .then(setBriefing)
      .catch(() => setBriefing([]));
  }, [open, briefing, api]);

  useEffect(() => {
    if (open && tab === "chat") inputRef.current?.focus();
  }, [open, tab]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function send(content: string) {
    const message = content.trim();
    if (!message || pending) return;
    const next: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(next);
    setDraft("");
    setTab("chat");
    startTransition(async () => {
      const history = next.filter((turn) => !turn.error).map(({ role, content: text }) => ({ role, content: text }));
      try {
        const result = await api.ask(history);
        setTurns((current) => [
          ...current,
          result.reply ? { role: "assistant", content: result.reply, typed: false } : { role: "assistant", content: result.error ?? "Hiba történt.", error: true },
        ]);
      } catch {
        setTurns((current) => [...current, { role: "assistant", content: "Nem sikerült elérni a szervert, próbáld újra.", error: true }]);
      }
    });
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  function openTicket(detail?: PajzsiTicketDetail) {
    if (tab === "ticket" && !detail) return setTab("chat");
    // Az aktuális oldalt a kattintás pillanatában olvassuk ki (a usePathname Suspense-határt kívánna).
    setTicketPage(window.location.pathname);
    setTicketSeed(detail?.text ?? [...turns].reverse().find((turn) => turn.role === "user")?.content ?? "");
    setTicketDiagnostics([...(detail?.diagnostics ?? []).map(scrub), ...clientIssues.current].slice(-8));
    setBubble(null);
    setOpen(true);
    setTab("ticket");
  }

  // Más oldalakról (pl. a hibaoldalról) érkező „jelentsd be” kérés.
  useEffect(() => {
    const onTicket = (event: Event) => openTicket((event as CustomEvent<PajzsiTicketDetail>).detail ?? {});
    window.addEventListener(PAJZSI_TICKET_EVENT, onTicket);
    return () => window.removeEventListener(PAJZSI_TICKET_EVENT, onTicket);
  });

  return (
    <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-3 print:hidden sm:right-6 sm:bottom-6">
      {open && (
        <section
          role="dialog"
          aria-label="Pajzsi, a HR védőangyala"
          className="pg-panel pg-pop pg-aurora relative flex h-[min(46rem,calc(100dvh-7.5rem))] w-[min(27rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.75rem] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(232,167,150,0.16)]"
        >
          <span aria-hidden className="pg-grid pointer-events-none absolute inset-0 opacity-40" />

          <header className="relative flex items-center gap-3 border-b border-white/8 px-4 py-3">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-white/12 to-white/3 ring-1 ring-white/10">
              <Mascot size={40} mood={mood} />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-ink-900 bg-pink-bright" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="pg-accent-text font-display text-lg leading-tight font-semibold">Pajzsi</p>
              <p className="truncate text-xs text-white/55" aria-live="polite">
                {SUBTITLE[mood]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openTicket()}
              aria-label="Hiba vagy kérés bejelentése"
              title="Hiba vagy kérés bejelentése"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${tab === "ticket" ? "bg-rose text-ink-950" : "border border-rose/40 text-rose hover:bg-rose/10"}`}
            >
              <Bug size={14} aria-hidden /> Bejelentés
            </button>
            {turns.length > 0 && tab === "chat" && (
              <button type="button" onClick={() => setTurns([])} aria-label="Új beszélgetés" title="Új beszélgetés" className="grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/8 hover:text-white">
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Bezárás" className="grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/8 hover:text-white">
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col">
            {tab === "chat" && (
              <ChatTab
                turns={turns}
                pending={pending}
                briefing={briefing}
                aiOn={aiOn}
                onSend={send}
                onOpenTab={(next) => (next === "ticket" ? openTicket() : setTab(next))}
                onMood={setOverride}
                onTyped={(index) => setTurns((current) => current.map((turn, i) => (i === index ? { ...turn, typed: true } : turn)))}
              />
            )}
            {tab === "ticket" && (
              <TicketForm
                key={`${ticketSeed}|${ticketDiagnostics.length}`}
                api={api}
                page={ticketPage}
                initialText={ticketSeed}
                diagnostics={ticketDiagnostics}
                onBack={() => setTab("chat")}
                onDone={() => setTab("chat")}
                onHappy={celebrate}
              />
            )}
          </div>

          {tab === "chat" &&
            (aiOn ? (
              <form onSubmit={onSubmit} className="relative flex items-end gap-2 border-t border-white/8 bg-ink-950/40 p-3">
                <label className="sr-only" htmlFor="pajzsi-input">
                  Kérdésed Pajzsinak
                </label>
                <textarea
                  id="pajzsi-input"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={1500}
                  rows={1}
                  placeholder="Kérdezz valamit…  (Ctrl/⌘+K)"
                  className="pg-field max-h-28 min-h-11 flex-1 resize-none rounded-xl bg-transparent px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button type="submit" disabled={pending || !draft.trim()} aria-label="Küldés" className="pg-button grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-40">
                  {pending ? <LoaderCircle size={18} aria-hidden className="animate-spin" /> : <ArrowUp size={19} aria-hidden />}
                </button>
              </form>
            ) : (
              <p className="relative border-t border-white/8 px-4 py-3 text-xs leading-snug text-white/50">
                A csevegés még nincs bekapcsolva (az AI-kulcs hiányzik), a bejelentés viszont működik.
              </p>
            ))}
        </section>
      )}

      <div className="relative">
        {bubble && !open && (
          <button
            type="button"
            onClick={toggle}
            className="pg-pop absolute right-[calc(100%+0.75rem)] bottom-3 w-max max-w-56 rounded-2xl rounded-br-md border border-rose/40 bg-ink-900/95 px-3.5 py-2 text-left text-sm text-white shadow-xl backdrop-blur"
          >
            {bubble}
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? "Pajzsi bezárása" : "Pajzsi megnyitása"}
          aria-expanded={open}
          title="Pajzsi (Ctrl/⌘+K)"
          className={`group relative grid size-[4.5rem] place-items-center rounded-full transition hover:scale-105 active:scale-95 ${open ? "" : "pg-glow"}`}
        >
          <span aria-hidden className="pg-aurora-ring absolute inset-0 rounded-full" />
          <span aria-hidden className="absolute inset-[3px] rounded-full bg-ink-900" />
          <span className="relative grid place-items-center">{open ? <X size={26} aria-hidden className="text-rose" /> : <Mascot size={54} mood={mood} float />}</span>
        </button>
      </div>
    </div>
  );
}

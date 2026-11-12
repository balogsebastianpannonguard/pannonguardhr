"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bug, CalendarHeart, ChevronRight, ClipboardCheck, Clock, FileSignature, Mail, HeartHandshake, Sparkles } from "lucide-react";
import type { BriefingItem } from "@/components/pajzsi/api";
import { Mascot, type Mood } from "@/components/pajzsi/mascot";

export type Turn = { role: "user" | "assistant"; content: string; error?: boolean; typed?: boolean };
export type TabKey = "chat" | "ticket";

/** A válaszokban kattinthatóvá tett belső útvonalak. */
// Hosszabb útvonal előbb, hogy a „/munkavallalok/uj” ne csak „/munkavallalok”-ként legyen link.
const ROUTES = ["/munkavallalok/uj", "/munkavallalok", "/lejaratok", "/tavollet", "/be-kilepes", "/dokumentumok", "/toborzas", "/kepzesek", "/kimutatasok", "/jog", "/kommunikacio", "/biztonsag"];

const TONE: Record<BriefingItem["tone"], string> = {
  ok: "border-emerald-400/25 bg-emerald-400/8 text-emerald-100",
  info: "border-white/10 bg-white/4 text-white/75",
  warn: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  bad: "border-red-400/35 bg-red-500/12 text-red-100",
};
const DOT: Record<BriefingItem["tone"], string> = { ok: "bg-emerald-400", info: "bg-white/40", warn: "bg-amber-300", bad: "bg-red-400" };

/** Kis, biztonságos „markdown”: **félkövér**, felsorolás és kattintható belső útvonalak. React-elemeket épít, HTML-t soha. */
export function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const pattern = new RegExp(`(\\*\\*[^*]+\\*\\*|${ROUTES.map((route) => route.replace("/", "\\/")).join("|")})`, "g");
    let last = 0;
    for (const match of line.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (index > last) parts.push(line.slice(last, index));
      const token = match[0];
      parts.push(
        token.startsWith("**") ? (
          <strong key={index} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        ) : (
          <Link key={index} href={token} className="font-medium text-rose underline decoration-rose/40 underline-offset-2 hover:decoration-rose">
            {token}
          </Link>
        ),
      );
      last = index + token.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  };
  return (
    <>
      {text.split("\n").map((raw, index) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <span key={index} className="block h-2" />;
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet)
          return (
            <span key={index} className="flex gap-2 pl-1">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-rose" />
              <span>{inline(bullet[1])}</span>
            </span>
          );
        return (
          <span key={index} className="block">
            {inline(line.replace(/^#+\s*/, ""))}
          </span>
        );
      })}
    </>
  );
}

/** Betűnként „begépelődő” válasz (csökkentett mozgásnál azonnal megjelenik). */
function Typed({ text, onDone, onTick }: { text: string; onDone: () => void; onTick: () => void }) {
  const [length, setLength] = useState(0);
  const done = useRef(onDone);
  const tick = useRef(onTick);
  useEffect(() => {
    done.current = onDone;
    tick.current = onTick;
  });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const instant = setTimeout(() => {
        setLength(text.length);
        done.current();
      }, 0);
      return () => clearTimeout(instant);
    }
    const step = Math.max(2, Math.ceil(text.length / 160));
    const timer = setInterval(() => {
      setLength((current) => {
        const next = Math.min(text.length, current + step);
        if (next >= text.length) {
          clearInterval(timer);
          queueMicrotask(() => done.current());
        }
        return next;
      });
      tick.current();
    }, 16);
    return () => clearInterval(timer);
  }, [text]);
  return (
    <span className={length < text.length ? "pg-caret" : undefined}>
      <RichText text={text.slice(0, length)} />
    </span>
  );
}

/** Amit Pajzsi tud: a kártya egy kattintással elküldi a kérdést (vagy megnyitja a bejelentést). */
const CAPABILITIES: { n: string; title: string; line: string; icon: typeof Bug; ask?: string }[] = [
  { n: "01", title: "Munkajogi kérdések", line: "Szabadság, felmondás, munkaidő", icon: CalendarHeart, ask: "Mennyi szabadság jár egy 34 éves, kétgyermekes munkavállalónak?" },
  { n: "02", title: "Levélvázlatok", line: "Ajánlat, elutasítás, körlevél", icon: Mail, ask: "Írj egy kedves, rövid állásajánlat-levelet vagyonőr munkakörre." },
  { n: "03", title: "Interjúkérdések", line: "Munkakörre szabva", icon: HeartHandshake, ask: "Adj 8 jó interjúkérdést vagyonőr jelöltnek, rövid magyarázattal." },
  { n: "04", title: "Belépési lista", line: "Mi kell az első munkanap előtt?", icon: ClipboardCheck, ask: "Készíts ellenőrzőlistát egy új vagyonőr belépéséhez az első munkanapig." },
  { n: "05", title: "Munkaköri leírás", line: "Vázlat percek alatt", icon: FileSignature, ask: "Írj munkaköri leírás vázlatot objektumvezető munkakörre." },
  { n: "06", title: "Hiba bejelentése", line: "A fejlesztő azonnal látja", icon: Bug },
];

export function ChatTab({
  turns,
  pending,
  briefing,
  aiOn,
  onSend,
  onOpenTab,
  onTyped,
  onMood,
}: {
  turns: Turn[];
  pending: boolean;
  briefing: BriefingItem[] | null;
  aiOn: boolean;
  onSend: (text: string) => void;
  onOpenTab: (tab: TabKey) => void;
  onTyped: (index: number) => void;
  onMood: (mood: Mood | null) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const scroll = () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, pending, briefing]);

  const fresh = turns.length === 0;
  return (
    <div ref={listRef} aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm leading-relaxed [scrollbar-width:thin]">
      {fresh && (
        <div className="pg-pop flex flex-col items-center pt-1 text-center">
          <Mascot size={92} mood="happy" float />
          <h2 className="mt-1 font-display text-2xl font-semibold">
            Szia, <span className="pg-accent-text">Pajzsi</span> vagyok!
          </h2>
          <p className="mt-1 max-w-[19rem] text-[0.82rem] text-white/60">A HR védőangyala. Kérdezz bátran munkajogról, levelekről vagy a felvételről, szívesen segítek! 💗</p>
        </div>
      )}

      {fresh && briefing === null && (
        <div className="space-y-2" aria-hidden>
          <div className="pg-skeleton h-10 rounded-xl" />
          <div className="pg-skeleton h-10 rounded-xl" />
        </div>
      )}
      {fresh && briefing && briefing.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 px-1 text-[0.68rem] font-bold tracking-[0.16em] text-white/40 uppercase">
            <Clock size={11} aria-hidden /> Mai helyzet
          </p>
          {briefing.map((item, index) => {
            const body = (
              <>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[item.tone]} ${item.tone === "bad" ? "animate-pulse" : ""}`} aria-hidden />
                <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug">{item.text}</span>
                {item.href && <ChevronRight size={15} aria-hidden className="mt-0.5 shrink-0 opacity-50" />}
              </>
            );
            const cls = `pg-pop flex items-start gap-2.5 rounded-xl border px-3 py-2 ${TONE[item.tone]}`;
            const style = { animationDelay: `${index * 60}ms` };
            return item.href ? (
              <Link key={index} href={item.href} style={style} className={`${cls} transition hover:brightness-125`}>
                {body}
              </Link>
            ) : (
              <div key={index} style={style} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      )}

      {fresh && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.68rem] font-bold tracking-[0.16em] text-white/40 uppercase">
            <Sparkles size={11} aria-hidden /> Amit tudok
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map(({ n, title, line, icon: Icon, ask }, index) => (
              <button
                key={n}
                type="button"
                onClick={() => (ask ? onSend(ask) : onOpenTab("ticket"))}
                disabled={Boolean(ask) && !aiOn}
                style={{ animationDelay: `${index * 55}ms` }}
                className="pg-pop group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/7 to-white/2 p-3 text-left transition enabled:hover:-translate-y-0.5 disabled:opacity-50 hover:border-rose/50 hover:shadow-[0_12px_30px_-14px_rgba(232,167,150,0.6)]"
              >
                <span aria-hidden className="absolute -top-6 -right-6 size-16 rounded-full bg-rose/10 blur-xl transition group-hover:bg-rose/25" />
                <span className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg bg-pink/25 text-rose transition group-hover:bg-rose group-hover:text-ink-950">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="font-mono text-[0.65rem] font-bold text-white/30">{n}</span>
                </span>
                <b className="mt-2 block text-[0.78rem] leading-tight">{title}</b>
                <span className="mt-0.5 block text-[0.66rem] leading-snug text-white/45">{line}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <div key={index} className="pg-pop flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-linear-to-br from-pink to-[#b8476f] px-3.5 py-2.5 whitespace-pre-wrap text-white shadow-lg shadow-pink/30">{turn.content}</div>
          </div>
        ) : (
          <div key={index} className="pg-pop flex gap-2.5">
            <span className="mt-0.5 shrink-0">
              <Mascot size={28} mood={turn.typed === false ? "talk" : "idle"} />
            </span>
            <div
              className={`max-w-[88%] space-y-0.5 rounded-2xl rounded-tl-md px-3.5 py-2.5 ${
                turn.error ? "border border-red-400/30 bg-red-500/10 text-red-100" : "border border-white/8 bg-white/7 text-white/90"
              }`}
            >
              {turn.typed === false && !turn.error ? (
                <Typed
                  text={turn.content}
                  onTick={scroll}
                  onDone={() => {
                    onTyped(index);
                    onMood(null);
                  }}
                />
              ) : (
                <RichText text={turn.content} />
              )}
            </div>
          </div>
        ),
      )}

      {pending && (
        <div className="pg-pop flex items-center gap-2.5" role="status" aria-label="Pajzsi gondolkodik">
          <Mascot size={28} mood="think" />
          <div className="flex gap-1 rounded-2xl rounded-tl-md border border-white/8 bg-white/7 px-4 py-3">
            {[0, 1, 2].map((n) => (
              <span key={n} className="pg-dot size-1.5 rounded-full bg-rose" style={{ animationDelay: `${n * 0.18}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

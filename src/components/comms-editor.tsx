"use client";

import { useState, useTransition } from "react";
import { Check, Copy, LoaderCircle, Minimize2, Printer, Save, Smile, Undo2, Landmark } from "lucide-react";
import { CommsDraftActions } from "@/components/comms-draft-actions";
import { AiNote } from "@/components/legal-note";
import { Feedback, Input, Label, Textarea, buttonClass } from "@/components/ui";
import { refineDraft, saveDraft, undoRefine } from "@/lib/actions/comms";

const REFINE_BUTTONS = [
  { mode: "rovidebb", label: "Rövidebb", icon: Minimize2 },
  { mode: "hivatalosabb", label: "Hivatalosabb", icon: Landmark },
  { mode: "baratsagosabb", label: "Barátságosabb", icon: Smile },
] as const;

export function CommsEditor({
  id,
  initialTitle,
  initialBody,
  hasPrevious,
  aiOn,
  meta,
}: {
  id: string;
  initialTitle: string;
  initialBody: string;
  hasPrevious: boolean;
  aiOn: boolean;
  meta: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saved, setSaved] = useState({ title: initialTitle, body: initialBody });
  const [canUndo, setCanUndo] = useState(hasPrevious);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const dirty = title !== saved.title || body !== saved.body;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  function run(label: string, task: () => Promise<{ error?: string; message?: string; body?: string }>, onBody?: () => void) {
    setBusy(label);
    setStatus({});
    start(async () => {
      const result = await task();
      setBusy(undefined);
      setStatus({ error: result.error, message: result.message });
      if (result.error) return;
      if (result.body !== undefined) {
        setBody(result.body);
        setSaved({ title, body: result.body });
        onBody?.();
      } else {
        setSaved({ title, body });
      }
    });
  }

  return (
    <>
      <section className="pg-panel min-w-0 space-y-4 rounded-3xl p-5 sm:p-6 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {REFINE_BUTTONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              disabled={pending || !aiOn}
              onClick={() => run(mode, () => refineDraft(id, mode, { title, body }), () => setCanUndo(true))}
              className={buttonClass("secondary", "sm")}
            >
              {busy === mode ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Icon size={15} aria-hidden />}
              {label}
            </button>
          ))}
          {canUndo && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("undo", () => undoRefine(id))}
              className={buttonClass("ghost", "sm")}
              title="Az utolsó átírás előtti szöveg visszaállítása"
            >
              {busy === "undo" ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Undo2 size={15} aria-hidden />}
              Visszavonás
            </button>
          )}
        </div>

        <Label label="Cím (csak a listához)">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </Label>
        <Label label="Szöveg" hint={`${words} szó · ${meta}`}>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={Math.min(30, Math.max(12, body.split("\n").length + 2))}
            disabled={pending && busy !== "save"}
            className="text-[15px]"
          />
        </Label>
        <AiNote />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !dirty} onClick={() => run("save", () => saveDraft(id, { title, body }))} className={buttonClass("primary", "sm")}>
            {busy === "save" ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Save size={15} aria-hidden />}
            {dirty ? "Mentés" : "Mentve"}
          </button>
          <button
            type="button"
            className={buttonClass("secondary", "sm")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                setStatus({ error: "A vágólapra másolás nem engedélyezett ebben a böngészőben." });
              }
            }}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
            {copied ? "Másolva" : "Másolás"}
          </button>
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => window.print()}>
            <Printer size={15} aria-hidden /> Nyomtatás
          </button>
          <CommsDraftActions id={id} afterDelete="/kommunikacio" />
        </div>
        <Feedback error={status.error} message={status.message} />
      </section>

      {/* Nyomtatási nézet: csak a dokumentum, fekete szöveggel. */}
      <article className="hidden text-[11.5pt] leading-relaxed whitespace-pre-wrap text-black print:block">{body}</article>
    </>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, WandSparkles } from "lucide-react";
import { Feedback, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { useKeepForm } from "@/components/use-keep-form";
import { generateDraft } from "@/lib/actions/comms";
import type { Template } from "@/lib/comms";
import type { FormState } from "@/lib/form";

type Options = Record<string, string>;
type Fields = Pick<Template, "type" | "tone" | "audience" | "length" | "subject" | "points">;

export function CommsForm({
  aiOn,
  types,
  tones,
  lengths,
  audiences,
  templates,
  defaultSignature,
}: {
  aiOn: boolean;
  types: Options;
  tones: Options;
  lengths: Options;
  audiences: string[];
  templates: Template[];
  defaultSignature: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(generateDraft, {});
  const { ref, onSubmit } = useKeepForm(action, state);
  const [fields, setFields] = useState<Fields>({ type: "email", tone: "kozvetlen", audience: audiences[0], length: "kozepes", subject: "", points: "" });
  const [withSignature, setWithSignature] = useState(true);
  const [signature, setSignature] = useState(defaultSignature);
  const [picked, setPicked] = useState<string>();
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (state.ok && state.id) router.push(`/kommunikacio/${state.id}`);
  }, [state, router]);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-white/50">Kész sablonok – kattints, és a mezők kitöltődnek</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setFields({ type: template.type, tone: template.tone, audience: template.audience, length: template.length, subject: template.subject, points: template.points });
                setPicked(template.id);
              }}
              className={`rounded-2xl border p-3 text-left transition ${
                picked === template.id ? "border-rose/50 bg-rose/10" : "border-white/8 bg-white/2 hover:border-rose/30 hover:bg-white/5"
              }`}
            >
              <span className="block text-sm font-semibold">{template.name}</span>
              <span className="mt-0.5 block text-xs text-white/50">{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      <form ref={ref} onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Label label="Dokumentum típusa">
            <Select name="type" value={fields.type} onChange={(event) => set("type", event.target.value as Fields["type"])}>
              {Object.entries(types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Hangnem">
            <Select name="tone" value={fields.tone} onChange={(event) => set("tone", event.target.value as Fields["tone"])}>
              {Object.entries(tones).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Kinek szól?">
            <Input name="audience" list="comms-audiences" value={fields.audience} onChange={(event) => set("audience", event.target.value)} maxLength={120} />
            <datalist id="comms-audiences">
              {audiences.map((audience) => (
                <option key={audience} value={audience} />
              ))}
            </datalist>
          </Label>
          <Label label="Terjedelem">
            <Select name="length" value={fields.length} onChange={(event) => set("length", event.target.value as Fields["length"])}>
              {Object.entries(lengths).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Label>
        </div>
        <Label label="Tárgy / téma">
          <Input name="subject" value={fields.subject} onChange={(event) => set("subject", event.target.value)} maxLength={160} placeholder="Pl. Változik a műszakátadás rendje" />
        </Label>
        <Label label="Kulcspontok" hint="Soronként egy gondolat. Ami hiányzik (dátum, helyszín), azt a vázlat [helykitöltővel] jelöli.">
          <Textarea
            name="points"
            rows={7}
            value={fields.points}
            onChange={(event) => set("points", event.target.value)}
            maxLength={6000}
            placeholder={"- Mi a lényeg?\n- Mit kell tenni, és meddig?\n- Kihez lehet fordulni?"}
          />
        </Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="withSignature" checked={withSignature} onChange={(event) => setWithSignature(event.target.checked)} className="size-4 accent-rose" />
            Aláírás hozzáadása
          </label>
          {withSignature && (
            <Textarea name="signature" rows={3} value={signature} onChange={(event) => setSignature(event.target.value)} maxLength={400} className="min-h-0 text-sm" />
          )}
        </div>
        <p className="text-xs text-white/45">
          A pontok feldolgozásra az AI-szolgáltatóhoz (Google Gemini) kerülnek. Egészségügyi, bér- vagy azonosító adatot ne írj bele; a
          mentett vázlat titkosítva tárolódik.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Feedback error={state.error} />
          <button type="submit" disabled={pending || !aiOn} className={buttonClass("primary")}>
            {pending ? <LoaderCircle size={17} aria-hidden className="animate-spin" /> : <WandSparkles size={17} aria-hidden />}
            {pending ? "Fogalmazás…" : "Vázlat készítése"}
          </button>
        </div>
      </form>
    </div>
  );
}

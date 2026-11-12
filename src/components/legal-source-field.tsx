"use client";

import { useRef, useState, useTransition } from "react";
import { CloudUpload, LoaderCircle } from "lucide-react";
import { Label, Textarea } from "@/components/ui";
import { MAX_UPLOAD_BYTES } from "@/components/use-keep-form";
import { extractLegalText } from "@/lib/actions/legal-hr";

/**
 * Szövegmező feltöltéssel: a PDF / JPG / PNG szövegét az AI kinyeri (OCR), és beírja a mezőbe, hogy beküldés előtt
 * át lehessen nézni. TXT-fájlt a böngésző közvetlenül olvas be.
 */
export function LegalSourceField({
  name,
  label,
  hint,
  rows = 10,
  placeholder,
  disabled,
  onFileName,
}: {
  name: string;
  label: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  onFileName?: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function pick(file?: File) {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ error: "A fájl legfeljebb 4 MB lehet." });
      return;
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    if (/\.txt$/i.test(file.name)) {
      file.text().then((text) => {
        setValue(text);
        onFileName?.(base);
        setStatus({ message: `Beolvasva: ${file.name}` });
      });
      return;
    }
    setStatus({});
    start(async () => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await extractLegalText(formData);
      if (result.text) {
        setValue(result.text);
        onFileName?.(base);
        setStatus({ message: `Szöveg kinyerve: ${file.name} – nézd át, mielőtt továbblépsz.` });
      } else {
        setStatus({ error: result.error ?? "A szöveg kinyerése nem sikerült." });
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label label={label} hint={hint}>
        <Textarea
          name={name}
          rows={rows}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          disabled={pending}
          className="font-[inherit] text-sm"
        />
      </Label>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-sm text-white/70 transition hover:border-rose/50 hover:text-white ${
            pending || disabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {pending ? <LoaderCircle size={16} aria-hidden className="animate-spin text-rose" /> : <CloudUpload size={16} aria-hidden className="text-rose" />}
          {pending ? "Szöveg kinyerése…" : "Fájl feltöltése (PDF, JPG, PNG, TXT)"}
          <input
            ref={input}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt"
            className="sr-only"
            disabled={pending || disabled}
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </label>
        {value && !pending && (
          <span className="text-xs text-white/40">{value.length.toLocaleString("hu-HU")} karakter</span>
        )}
      </div>
      {(status.error || status.message) && (
        <p role="status" className={`text-xs ${status.error ? "text-red-300" : "text-white/55"}`}>
          {status.error ?? status.message}
        </p>
      )}
    </div>
  );
}

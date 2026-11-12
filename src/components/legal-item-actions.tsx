"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Printer, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { deleteLegalItem } from "@/lib/actions/legal-hr";

export function LegalItemActions({ id, copyText }: { id: string; copyText: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setError("A vágólapra másolás nem engedélyezett ebben a böngészőben.");
          }
        }}
      >
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copied ? "Másolva" : "Másolás"}
      </button>
      <button type="button" className={buttonClass("secondary", "sm")} onClick={() => window.print()}>
        <Printer size={15} aria-hidden /> Nyomtatás
      </button>
      <button
        type="button"
        disabled={pending}
        className={buttonClass("danger", "sm")}
        onClick={() => {
          if (!confirm("Biztosan törlöd ezt az előzményt? Nem vonható vissza.")) return;
          start(async () => {
            const result = await deleteLegalItem(id);
            if (result.error) setError(result.error);
            else router.push("/jog");
          });
        }}
      >
        <Trash2 size={15} aria-hidden /> Törlés
      </button>
      {error && <p className="w-full text-sm text-red-300">{error}</p>}
    </div>
  );
}

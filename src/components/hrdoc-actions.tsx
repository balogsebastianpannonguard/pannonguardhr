"use client";

import { useTransition } from "react";
import { LoaderCircle, Printer, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { deleteHrDocument } from "@/lib/actions/hr-documents";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary", "sm")}>
      <Printer size={15} aria-hidden /> Nyomtatás / PDF
    </button>
  );
}

export function DeleteDocumentButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Biztosan törlöd ezt a dokumentumot? Ez nem vonható vissza.")) startTransition(async () => void (await deleteHrDocument(id)));
      }}
      className={buttonClass("danger", "sm")}
    >
      {pending ? <LoaderCircle size={15} aria-hidden className="animate-spin" /> : <Trash2 size={15} aria-hidden />} Törlés
    </button>
  );
}

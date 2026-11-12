"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, LoaderCircle, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { deleteDraft, duplicateDraft } from "@/lib/actions/comms";

/** Másolat és törlés – a vázlatlistában (kis ikonok) és a szerkesztőben (gombok) is. */
export function CommsDraftActions({ id, compact = false, afterDelete }: { id: string; compact?: boolean; afterDelete?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const iconButton = "grid size-8 place-items-center rounded-lg text-white/45 transition hover:bg-white/8 hover:text-white disabled:opacity-40";

  function duplicate() {
    start(async () => {
      const result = await duplicateDraft(id);
      if (result.id) router.push(`/kommunikacio/${result.id}`);
      else setError(result.error);
    });
  }

  function remove() {
    if (!confirm("Biztosan törlöd ezt a vázlatot? Nem vonható vissza.")) return;
    start(async () => {
      const result = await deleteDraft(id);
      if (result.error) setError(result.error);
      else if (afterDelete) router.push(afterDelete);
    });
  }

  if (compact)
    return (
      <span className="flex shrink-0 items-center" title={error}>
        {pending ? (
          <LoaderCircle size={15} aria-hidden className="mx-2 animate-spin text-rose" />
        ) : (
          <>
            <button type="button" onClick={duplicate} className={iconButton} aria-label="Másolat készítése" title="Másolat">
              <CopyPlus size={15} aria-hidden />
            </button>
            <button type="button" onClick={remove} className={`${iconButton} hover:text-red-300`} aria-label="Törlés" title="Törlés">
              <Trash2 size={15} aria-hidden />
            </button>
          </>
        )}
      </span>
    );

  return (
    <>
      <button type="button" disabled={pending} onClick={duplicate} className={buttonClass("secondary", "sm")}>
        <CopyPlus size={15} aria-hidden /> Másolat
      </button>
      <button type="button" disabled={pending} onClick={remove} className={buttonClass("danger", "sm")}>
        <Trash2 size={15} aria-hidden /> Törlés
      </button>
      {error && <p className="w-full text-sm text-red-300">{error}</p>}
    </>
  );
}
